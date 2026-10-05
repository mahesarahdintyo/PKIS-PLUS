// =========================================================
// useAndon — hooks untuk halaman /admin/andon-settings
// Porting dari project-experiment/hooks/useAndon.ts
// Import supabase diganti ke pola PKIS-PLUS (@/lib/supabase/client)
// Tabel andon_calls/andon_leaders/push_subscriptions TIDAK diprefiks prod_
// karena tabel ini bukan dari migration 0001_add_production_system.sql
// =========================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/db/client";

// Public VAPID key — dipasangkan dengan VAPID_PRIVATE_KEY di edge function send-andon-push.
const ANDON_VAPID_PUBLIC_KEY = "BCPEeRkRPz2P0UQKWiu1X3nAjZ5C3UrVG4In4KJXw8Z9TGJhHlRxCzxbqPekSEU7M_nOsoitqZr9Ry7Q0bFeNAw";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export async function andonSubscribePush(userId: string): Promise<{ ok: boolean; message: string }> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, message: "Browser HP ini tidak mendukung notifikasi push." };
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, message: "Izin notifikasi ditolak. Aktifkan lewat pengaturan browser." };
  }
  try {
    const supabase = createClient();
    const reg = await navigator.serviceWorker.ready;
    const existingSub = await reg.pushManager.getSubscription();
    if (existingSub) {
      await existingSub.unsubscribe();
    }
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(ANDON_VAPID_PUBLIC_KEY) as BufferSource,
    });
    const json = sub.toJSON();
    const { error } = await supabase.from("push_subscriptions" as any).upsert(
      {
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys!.p256dh,
        auth_key: json.keys!.auth,
        device_label: navigator.userAgent.slice(0, 120),
      },
      { onConflict: "endpoint" }
    );
    if (error) return { ok: false, message: "Gagal simpan pendaftaran: " + error.message };

    // Verifikasi kembali status pendaftaran langsung ke pushManager.getSubscription()
    const activeSub = await reg.pushManager.getSubscription();
    if (!activeSub) {
      return { ok: false, message: "Gagal mengonfirmasi pendaftaran push di browser." };
    }

    return { ok: true, message: "HP ini berhasil didaftarkan menerima panggilan Andon." };
  } catch (e: any) {
    return { ok: false, message: "Gagal mendaftar: " + (e?.message || String(e)) };
  }
}

export interface AndonCall {
  id: string;
  line_id?: string | null;
  line_name?: string | null;
  mesin: string;
  stasiun: string | null;
  alasan: string | null;
  status: "pending" | "acknowledged" | "escalated";
  triggered_by: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  escalated_at: string | null;
  created_at: string;
}

export interface AndonLeader {
  id: string;
  user_id: string;
  mesin: string;
  tier: 1 | 2;
  created_at: string;
}

// Insert panggilan Andon baru — dipakai dari halaman mesin lewat tombol "🔔 Panggil Leader".
export async function panggilLeaderAndon(params: {
  line_id?: string | null;
  line_name?: string | null;
  mesin: string;
  stasiun?: string | null;
  alasan?: string;
  triggeredBy?: string | null;
}): Promise<{ error: string | null; callId: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("andon_calls" as any)
    .insert({
      line_id: params.line_id || null,
      line_name: params.line_name || null,
      mesin: params.mesin,
      stasiun: params.stasiun || null,
      alasan: params.alasan || null,
      triggered_by: params.triggeredBy || null,
    })
    .select("id")
    .single();
  return { error: error ? error.message : null, callId: (data as any)?.id || null };
}

// Hook untuk halaman mesin: state andonCalling + activeCall + fungsi panggilLeader() & matikanPanggilan().
export function usePanggilLeader(params: {
  line_id?: string | null;
  line_name?: string | null;
  mesin: string;
  stasiun?: string | null;
  triggeredBy?: string | null;
  onDone?: (msg: string, isError: boolean) => void;
}) {
  const supabase = createClient();
  const [andonCalling, setAndonCalling] = useState(false);
  const [activeCall, setActiveCall] = useState<AndonCall | null>(null);
  const activeCallRef = useRef<AndonCall | null>(null);
  activeCallRef.current = activeCall;

  // [ANDON_OPERATOR_KONFIRMASI] Simpan panggilan yang baru di-acknowledge oleh leader.
  // Card konfirmasi tetap tampil sampai operator menekan dismissAcknowledged().
  const [acknowledgedCall, setAcknowledgedCall] = useState<AndonCall | null>(null);
  const [loadingActiveCall, setLoadingActiveCall] = useState(true);
  // Lacak ID panggilan yang sedang ditrack agar bisa deteksi transisi pending→acknowledged
  const trackedCallIdRef = useRef<string | null>(null);
  const { line_id, line_name, mesin, stasiun, triggeredBy, onDone } = params;

  // [STATUS_PANGGILAN_ANDON_OPERATOR] Ambil panggilan aktif untuk line/mesin ini
  const loadActiveCall = useCallback(async () => {
    try {
      let query = supabase
        .from("andon_calls" as any)
        .select("*")
        .in("status", ["pending", "escalated"])
        .order("created_at", { ascending: false });

      if (line_id) {
        query = query.or(`line_id.eq.${line_id},mesin.eq.${mesin}`);
      } else {
        query = query.eq("mesin", mesin);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        const found = (data as AndonCall[])[0];
        setActiveCall(found);
        activeCallRef.current = found;
        trackedCallIdRef.current = found.id;
        return;
      }

      // Jika tidak ada panggilan pending / escalated
      setActiveCall(null);
      activeCallRef.current = null;

      // Cek apakah ada panggilan yang baru dikonfirmasi (misal dalam 1 jam) dan belum di-dismiss
      try {
        let ackQuery = supabase
          .from("andon_calls" as any)
          .select("*")
          .eq("status", "acknowledged")
          .order("acknowledged_at", { ascending: false })
          .limit(1);

        if (line_id) {
          ackQuery = ackQuery.or(`line_id.eq.${line_id},mesin.eq.${mesin}`);
        } else {
          ackQuery = ackQuery.eq("mesin", mesin);
        }

        const { data: ackData } = await ackQuery;
        if (ackData && ackData.length > 0) {
          const latestAck = ackData[0] as AndonCall;
          const ackTime = latestAck.acknowledged_at ? new Date(latestAck.acknowledged_at).getTime() : 0;
          const isRecent = (Date.now() - ackTime) < 60 * 60 * 1000;
          const isDismissed = typeof window !== "undefined" && localStorage.getItem(`andon_dismissed_${latestAck.id}`) === "true";

          if (isRecent && !isDismissed && trackedCallIdRef.current === latestAck.id) {
            setAcknowledgedCall(latestAck);
          }
        }
      } catch (ackErr) {
        console.warn("Gagal cek recent acknowledged call:", ackErr);
      }
    } catch (err) {
      console.error("Gagal load status panggilan andon:", err);
    } finally {
      setLoadingActiveCall(false);
    }
  }, [line_id, mesin, supabase]);

  // [STATUS_PANGGILAN_ANDON_OPERATOR] Listener realtime untuk tabel andon_calls
  useEffect(() => {
    loadActiveCall();

    const channelName = `andon_status_${line_id || mesin}_${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "andon_calls",
        },
        (payload: any) => {
          const newRow = payload.new as AndonCall;
          const oldRow = payload.old as AndonCall;
          const isRelated =
            (newRow?.line_id && newRow.line_id === line_id) ||
            (newRow?.mesin && newRow.mesin === mesin) ||
            (oldRow?.line_id && oldRow.line_id === line_id) ||
            (oldRow?.mesin && oldRow.mesin === mesin);

          // [ANDON_OPERATOR_KONFIRMASI] Deteksi transisi: panggilan yang sedang ditrack / aktif
          // berubah menjadi 'acknowledged' → pindahkan ke acknowledgedCall, jangan langsung null.
          if (newRow?.status === "acknowledged" && isRelated) {
            const isTarget =
              (trackedCallIdRef.current && newRow?.id === trackedCallIdRef.current) ||
              (activeCallRef.current && newRow?.id === activeCallRef.current.id);

            if (isTarget || activeCallRef.current) {
              setActiveCall(null);
              activeCallRef.current = null;
              trackedCallIdRef.current = null;
              setAcknowledgedCall(newRow);

              // Getaran haptic singkat untuk memberitahu operator bahwa leader telah konfirmasi
              if (typeof navigator !== "undefined" && navigator.vibrate) {
                try {
                  navigator.vibrate([150, 100, 150]);
                } catch {}
              }
              return;
            }
          }

          if (isRelated || !line_id) {
            loadActiveCall();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [line_id, mesin, loadActiveCall, supabase]);

  const panggilLeader = useCallback(
    async (alasan: string) => {
      setAndonCalling(true);
      // Reset acknowledged state saat panggilan baru dibuat
      setAcknowledgedCall(null);
      const { error, callId } = await panggilLeaderAndon({
        line_id,
        line_name,
        mesin,
        stasiun,
        alasan,
        triggeredBy,
      });
      setAndonCalling(false);
      if (error) onDone?.(`Gagal memanggil leader: ${error}`, true);
      else {
        if (callId) {
          trackedCallIdRef.current = callId;
        }
        onDone?.("Leader sudah dipanggil. Menunggu respons...", false);
        await loadActiveCall();
        if (callId) {
          fetch("/api/push/send-andon", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ call_id: callId, tier: 1 }),
          })
            .then((res) => res.json())
            .then((result) => {
              if (result.error) {
                console.error("Gagal mengirim notifikasi push andon:", result.error);
              }
            })
            .catch((err) => {
              console.error("Error memanggil /api/push/send-andon:", err);
            });
        }
      }
    },
    [line_id, line_name, mesin, stasiun, triggeredBy, onDone, loadActiveCall, supabase.functions]
  );

  // [STATUS_PANGGILAN_ANDON_OPERATOR] Fungsi untuk mematikan / menyelesaikan panggilan Andon oleh Operator atau Leader
  const matikanPanggilan = useCallback(
    async (callId?: string) => {
      const targetId = callId || activeCall?.id;
      if (!targetId) return false;

      try {
        const { error } = await supabase
          .from("andon_calls" as any)
          .update({
            status: "acknowledged",
            acknowledged_by: triggeredBy || null,
            acknowledged_at: new Date().toISOString(),
          })
          .eq("id", targetId);

        if (error) {
          onDone?.(`Gagal mematikan panggilan: ${error.message}`, true);
          return false;
        } else {
          onDone?.("Panggilan Andon telah dimatikan / diselesaikan.", false);
          return true;
        }
      } catch (err: any) {
        onDone?.(`Gagal mematikan panggilan: ${err?.message || String(err)}`, true);
        return false;
      }
    },
    [activeCall?.id, triggeredBy, onDone, supabase]
  );

  // [ANDON_OPERATOR_KONFIRMASI] Operator menekan OK/Selesai setelah melihat konfirmasi leader
  const dismissAcknowledged = useCallback(() => {
    if (acknowledgedCall?.id && typeof window !== "undefined") {
      try {
        localStorage.setItem(`andon_dismissed_${acknowledgedCall.id}`, "true");
      } catch {}
    }
    setAcknowledgedCall(null);
    trackedCallIdRef.current = null;
  }, [acknowledgedCall?.id]);

  return { andonCalling, panggilLeader, activeCall, acknowledgedCall, dismissAcknowledged, loadingActiveCall, matikanPanggilan, reloadActiveCall: loadActiveCall };
}


// Hook untuk halaman andon-settings: daftar panggilan aktif (realtime).
export function useAndonAlerts(enabled: boolean) {
  const supabase = createClient();
  const [activeCalls, setActiveCalls] = useState<AndonCall[]>([]);

  const channelNameRef = useRef(
    `andon_calls_watch_${Math.random().toString(36).slice(2)}`
  );

  const loadActive = useCallback(async () => {
    const { data } = await supabase
      .from("andon_calls" as any)
      .select("*")
      .in("status", ["pending", "escalated"])
      .order("created_at", { ascending: false });
    setActiveCalls((data as AndonCall[]) || []);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!enabled) {
      setActiveCalls([]);
      return;
    }
    loadActive();

    const channel = supabase
      .channel(channelNameRef.current)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "andon_calls" },
        () => loadActive()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, loadActive]); // eslint-disable-line react-hooks/exhaustive-deps

  const acknowledgeCall = useCallback(async (id: string, acknowledgedBy?: string | null) => {
    setActiveCalls((prev) => prev.filter((c) => c.id !== id));
    await supabase
      .from("andon_calls" as any)
      .update({
        status: "acknowledged",
        acknowledged_by: acknowledgedBy || null,
        acknowledged_at: new Date().toISOString(),
      })
      .eq("id", id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { activeCalls, acknowledgeCall };
}

// Hook untuk halaman andon-settings: kelola pendaftaran leader (mesin + tier).
export function useAndonLeaders(userId: string | null | undefined) {
  const supabase = createClient();
  const [myLeaders, setMyLeaders] = useState<AndonLeader[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMyLeaders = useCallback(async () => {
    if (!userId) {
      setMyLeaders([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("andon_leaders" as any)
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("mesin");
    setMyLeaders((data as AndonLeader[]) || []);
    setLoading(false);
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchMyLeaders();
  }, [fetchMyLeaders]);

  const daftarLeader = useCallback(
    async (mesin: string, tier: 1 | 2): Promise<{ error: string | null }> => {
      if (!userId) return { error: "Belum login." };
      // Gunakan upsert agar jika baris lama ada (is_active=false karena pernah dihapus),
      // baris tersebut diaktifkan kembali tanpa melanggar unique constraint.
      const { error } = await supabase
        .from("andon_leaders" as any)
        .upsert(
          { user_id: userId, mesin, tier, is_active: true },
          { onConflict: "user_id,mesin,tier" }
        );
      if (error) {
        await fetchMyLeaders();
        return { error: error.message };
      }
      await fetchMyLeaders();
      return { error: null };
    },
    [userId, fetchMyLeaders] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const hapusLeader = useCallback(
    async (id: string) => {
      await supabase.from("andon_leaders" as any).update({ is_active: false }).eq("id", id);
      await fetchMyLeaders();
    },
    [fetchMyLeaders] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return { myLeaders, loading, daftarLeader, hapusLeader };
}
