// =========================================================
// useAndon — hooks untuk halaman /admin/andon-settings
// Porting dari project-experiment/hooks/useAndon.ts
// Import supabase diganti ke pola PKIS-PLUS (@/lib/supabase/client)
// Tabel andon_calls/andon_leaders/push_subscriptions TIDAK diprefiks prod_
// karena tabel ini bukan dari migration 0001_add_production_system.sql
// =========================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Public VAPID key — dipasangkan dengan VAPID_PRIVATE_KEY di edge function send-andon-push.
const ANDON_VAPID_PUBLIC_KEY = "BGh5QHGjVlSoFFRSQspuPhA9NllcyRGGlcETi3wDEYvvHvvhCyJ5quRAoLZO0JJIRYRtrHauc5gcT5_XO4Bavrc";

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
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(ANDON_VAPID_PUBLIC_KEY) as BufferSource,
      });
    }
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

// Hook untuk halaman mesin: state andonCalling + fungsi panggilLeader().
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
  const { line_id, line_name, mesin, stasiun, triggeredBy, onDone } = params;

  const panggilLeader = useCallback(
    async (alasan: string) => {
      setAndonCalling(true);
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
        onDone?.("Leader sudah dipanggil.", false);
        if (callId) {
          supabase.functions
            .invoke("send-andon-push", { body: { call_id: callId, tier: 1 } })
            .then(({ error: fnError }) => {
              if (fnError) {
                console.error("Gagal mengirim notifikasi push andon (edge function error):", fnError);
              }
            })
            .catch((err) => {
              console.error("Error memanggil edge function send-andon-push:", err);
            });
        }
      }
    },
    [line_id, line_name, mesin, stasiun, triggeredBy, onDone]
  );

  return { andonCalling, panggilLeader };
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
      const { error } = await supabase
        .from("andon_leaders" as any)
        .insert({ user_id: userId, mesin, tier, is_active: true });
      if (error) {
        await fetchMyLeaders();
        return { error: error.code === "23505" ? "Sudah terdaftar utk line & tier ini." : error.message };
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
