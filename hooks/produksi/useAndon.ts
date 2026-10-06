// =========================================================
// useAndon — hooks untuk halaman /admin/andon-settings
// Menggunakan andonApi dan Socket.io dari @/lib/api-client
// =========================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { andonApi, subscribeToSocketEvent } from "@/lib/api-client";

// Public VAPID key — dipasangkan dengan VAPID_PRIVATE_KEY di edge function send-andon-push.
const ANDON_VAPID_PUBLIC_KEY =
  "BCPEeRkRPz2P0UQKWiu1X3nAjZ5C3UrVG4In4KJXw8Z9TGJhHlRxCzxbqPekSEU7M_nOsoitqZr9Ry7Q0bFeNAw";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export async function andonSubscribePush(
  userId: string
): Promise<{ ok: boolean; message: string }> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, message: "Browser HP ini tidak mendukung notifikasi push." };
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, message: "Izin notifikasi ditolak. Aktifkan lewat pengaturan browser." };
  }
  try {
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
    const { error } = await andonApi.savePushSubscription({
      user_id: userId,
      endpoint: json.endpoint!,
      p256dh: json.keys!.p256dh!,
      auth_key: json.keys!.auth!,
      device_label: navigator.userAgent.slice(0, 120),
    });
    if (error) return { ok: false, message: "Gagal simpan pendaftaran: " + (error.message || String(error)) };

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
  const { data, error } = await andonApi.createCall({
    line_id: params.line_id || null,
    line_name: params.line_name || null,
    mesin: params.mesin,
    stasiun: params.stasiun || null,
    alasan: params.alasan || null,
    triggered_by: params.triggeredBy || null,
  });
  return { error: error ? (error.message || String(error)) : null, callId: data?.id || null };
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
  const [andonCalling, setAndonCalling] = useState(false);
  const [activeCall, setActiveCall] = useState<AndonCall | null>(null);
  const activeCallRef = useRef<AndonCall | null>(null);
  activeCallRef.current = activeCall;

  // [ANDON_OPERATOR_KONFIRMASI] Simpan panggilan yang baru di-acknowledge oleh leader.
  const [acknowledgedCall, setAcknowledgedCall] = useState<AndonCall | null>(null);
  const [loadingActiveCall, setLoadingActiveCall] = useState(true);
  const trackedCallIdRef = useRef<string | null>(null);
  const { line_id, line_name, mesin, stasiun, triggeredBy, onDone } = params;

  // [STATUS_PANGGILAN_ANDON_OPERATOR] Ambil panggilan aktif untuk line/mesin ini
  const loadActiveCall = useCallback(async () => {
    try {
      const { data, error } = await andonApi.getCalls({
        status: ["pending", "escalated"],
        line_id: line_id || undefined,
        mesin: line_id ? undefined : mesin,
      });

      if (!error && data && data.length > 0) {
        const found = data[0] as AndonCall;
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
        const { data: ackData } = await andonApi.getCalls({
          status: ["acknowledged"],
          line_id: line_id || undefined,
          mesin: line_id ? undefined : mesin,
          limit: 1,
        });

        if (ackData && ackData.length > 0) {
          const latestAck = ackData[0] as AndonCall;
          const ackTime = latestAck.acknowledged_at
            ? new Date(latestAck.acknowledged_at).getTime()
            : 0;
          const isRecent = Date.now() - ackTime < 60 * 60 * 1000;
          const isDismissed =
            typeof window !== "undefined" &&
            localStorage.getItem(`andon_dismissed_${latestAck.id}`) === "true";

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
  }, [line_id, mesin]);

  // [STATUS_PANGGILAN_ANDON_OPERATOR] Listener realtime Socket.io untuk tabel andon_calls
  useEffect(() => {
    loadActiveCall();

    const unsubscribe = subscribeToSocketEvent("andon_calls", "*", (payload: any) => {
      const newRow = (payload?.new || payload) as AndonCall;
      const oldRow = (payload?.old || {}) as AndonCall;
      const isRelated =
        (newRow?.line_id && newRow.line_id === line_id) ||
        (newRow?.mesin && newRow.mesin === mesin) ||
        (oldRow?.line_id && oldRow.line_id === line_id) ||
        (oldRow?.mesin && oldRow.mesin === mesin);

      if (newRow?.status === "acknowledged" && isRelated) {
        const isTarget =
          (trackedCallIdRef.current && newRow?.id === trackedCallIdRef.current) ||
          (activeCallRef.current && newRow?.id === activeCallRef.current.id);

        if (isTarget || activeCallRef.current) {
          setActiveCall(null);
          activeCallRef.current = null;
          trackedCallIdRef.current = null;
          setAcknowledgedCall(newRow);

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
    });

    return () => {
      unsubscribe();
    };
  }, [line_id, mesin, loadActiveCall]);

  const panggilLeader = useCallback(
    async (alasan: string) => {
      setAndonCalling(true);
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
    [line_id, line_name, mesin, stasiun, triggeredBy, onDone, loadActiveCall]
  );

  // [STATUS_PANGGILAN_ANDON_OPERATOR] Fungsi untuk mematikan / menyelesaikan panggilan Andon
  const matikanPanggilan = useCallback(
    async (callId?: string) => {
      const targetId = callId || activeCall?.id;
      if (!targetId) return false;

      try {
        const { error } = await andonApi.updateCall(targetId, {
          status: "acknowledged",
          acknowledged_by: triggeredBy || null,
          acknowledged_at: new Date().toISOString(),
        });

        if (error) {
          onDone?.(`Gagal mematikan panggilan: ${error.message || String(error)}`, true);
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
    [activeCall?.id, triggeredBy, onDone]
  );

  const dismissAcknowledged = useCallback(() => {
    if (acknowledgedCall?.id && typeof window !== "undefined") {
      try {
        localStorage.setItem(`andon_dismissed_${acknowledgedCall.id}`, "true");
      } catch {}
    }
    setAcknowledgedCall(null);
    trackedCallIdRef.current = null;
  }, [acknowledgedCall?.id]);

  return {
    andonCalling,
    panggilLeader,
    activeCall,
    acknowledgedCall,
    dismissAcknowledged,
    loadingActiveCall,
    matikanPanggilan,
    reloadActiveCall: loadActiveCall,
  };
}

// Hook untuk halaman andon-settings: daftar panggilan aktif (realtime).
export function useAndonAlerts(enabled: boolean) {
  const [activeCalls, setActiveCalls] = useState<AndonCall[]>([]);

  const loadActive = useCallback(async () => {
    const { data } = await andonApi.getCalls({
      status: ["pending", "escalated"],
    });
    setActiveCalls((data as AndonCall[]) || []);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setActiveCalls([]);
      return;
    }
    loadActive();

    const unsubscribe = subscribeToSocketEvent("andon_calls", "*", () => {
      loadActive();
    });

    return () => {
      unsubscribe();
    };
  }, [enabled, loadActive]);

  const acknowledgeCall = useCallback(
    async (id: string, acknowledgedBy?: string | null) => {
      setActiveCalls((prev) => prev.filter((c) => c.id !== id));
      await andonApi.updateCall(id, {
        status: "acknowledged",
        acknowledged_by: acknowledgedBy || null,
        acknowledged_at: new Date().toISOString(),
      });
    },
    []
  );

  return { activeCalls, acknowledgeCall };
}

// Hook untuk halaman andon-settings: kelola pendaftaran leader (mesin + tier).
export function useAndonLeaders(userId: string | null | undefined) {
  const [myLeaders, setMyLeaders] = useState<AndonLeader[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMyLeaders = useCallback(async () => {
    if (!userId) {
      setMyLeaders([]);
      return;
    }
    setLoading(true);
    const { data } = await andonApi.getLeaders({
      user_id: userId,
      is_active: true,
    });
    setMyLeaders((data as AndonLeader[]) || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchMyLeaders();
  }, [fetchMyLeaders]);

  const daftarLeader = useCallback(
    async (mesin: string, tier: 1 | 2): Promise<{ error: string | null }> => {
      if (!userId) return { error: "Belum login." };
      const { error } = await andonApi.upsertLeader({
        user_id: userId,
        mesin,
        tier,
      });
      if (error) {
        await fetchMyLeaders();
        return { error: error.message || String(error) };
      }
      await fetchMyLeaders();
      return { error: null };
    },
    [userId, fetchMyLeaders]
  );

  const hapusLeader = useCallback(
    async (id: string) => {
      await andonApi.deactivateLeader(id);
      await fetchMyLeaders();
    },
    [fetchMyLeaders]
  );

  return { myLeaders, loading, daftarLeader, hapusLeader };
}
