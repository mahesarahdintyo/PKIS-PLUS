// =========================================================
// useAndon — sistem panggil leader (Andon), in-app (realtime Supabase)
// + push notification (saat app tertutup). Skema andon_calls di sini
// mengikuti apa yang BENAR-BENAR live di database production (dicek
// langsung lewat REST API), sama seperti skema vanilla asli — BUKAN
// skema reason/called_by/called_by_name/resolved_by yang ada di
// migration_andon_v1.sql tapi ternyata tidak pernah dideploy.
// =========================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Public VAPID key — dipasangkan dengan VAPID_PRIVATE_KEY yang di-set sbg
// secret di edge function send-andon-push (bukan disimpan di repo). Kalau
// pasangan private key-nya diganti, key publik di sini WAJIB ikut diganti.
const ANDON_VAPID_PUBLIC_KEY = "BGh5QHGjVlSoFFRSQspuPhA9NllcyRGGlcETi3wDEYvvHvvhCyJ5quRAoLZO0JJIRYRtrHauc5gcT5_XO4Bavrc";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// Minta izin notifikasi & daftarkan device ini (browser/HP) supaya bisa
// nerima push Andon walau app tertutup. Dipanggil dari tombol "Aktifkan
// Notifikasi di HP ini" di /andon-settings.
export async function andonSubscribePush(userId: string): Promise<{ ok: boolean; message: string }> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, message: "Browser HP ini tidak mendukung notifikasi push." };
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, message: "Izin notifikasi ditolak. Aktifkan lewat pengaturan browser." };
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(ANDON_VAPID_PUBLIC_KEY) as BufferSource,
      });
    }
    const json = sub.toJSON();
    const { error } = await supabase.from("push_subscriptions").upsert(
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

// Insert panggilan Andon baru — dipakai dari halaman mesin lewat tombol
// "🔔 Panggil Leader".
export async function panggilLeaderAndon(params: {
  mesin: string;
  stasiun?: string | null;
  alasan?: string;
  triggeredBy?: string | null;
}): Promise<{ error: string | null; callId: string | null }> {
  const { data, error } = await supabase
    .from("andon_calls")
    .insert({
      mesin: params.mesin,
      stasiun: params.stasiun || null,
      alasan: params.alasan || null,
      triggered_by: params.triggeredBy || null,
    })
    .select("id")
    .single();
  return { error: error ? error.message : null, callId: data?.id || null };
}

// Hook untuk halaman mesin: state andonCalling + fungsi panggilLeader().
export function usePanggilLeader(params: {
  mesin: string;
  stasiun?: string | null;
  triggeredBy?: string | null;
  onDone?: (msg: string, isError: boolean) => void;
}) {
  const [andonCalling, setAndonCalling] = useState(false);
  const { mesin, stasiun, triggeredBy, onDone } = params;

  const panggilLeader = useCallback(
    async (alasan: string) => {
      setAndonCalling(true);
      const { error, callId } = await panggilLeaderAndon({
        mesin,
        stasiun,
        alasan,
        triggeredBy,
      });
      setAndonCalling(false);
      if (error) onDone?.(`Gagal memanggil leader: ${error}`, true);
      else {
        onDone?.("Leader sudah dipanggil.", false);
        // Trigger push notification ke leader tier 1 (best-effort — kalau
        // edge function belum di-deploy/gagal, panggilan tetap tercatat
        // dan overlay realtime in-app tetap jalan).
        if (callId) {
          supabase.functions.invoke("send-andon-push", { body: { call_id: callId, tier: 1 } }).catch(() => {});
        }
      }
    },
    [mesin, stasiun, triggeredBy, onDone]
  );

  return { andonCalling, panggilLeader };
}

// Hook untuk overlay alert (dipakai leader/admin): daftar panggilan aktif
// (status 'pending' atau 'escalated' — belum ditekan TERIMA), realtime
// via Supabase Postgres Changes.
export function useAndonAlerts(enabled: boolean) {
  const [activeCalls, setActiveCalls] = useState<AndonCall[]>([]);

  // Nama channel HARUS unik per instance hook — kalau dua komponen (mis.
  // AndonAlertOverlay di HeaderNav yang selalu aktif di semua halaman +
  // halaman /andon-settings yang juga pakai hook ini) subscribe ke topic
  // Supabase Realtime yang SAMA secara bersamaan, channel-nya bentrok dan
  // (terutama di React Strict Mode dev, yang mount/cleanup/mount effect 2x)
  // bisa memicu reconnect loop tak berujung sampai tab crash.
  const channelNameRef = useRef(
    `andon_calls_watch_${Math.random().toString(36).slice(2)}`
  );

  const loadActive = useCallback(async () => {
    const { data } = await supabase
      .from("andon_calls")
      .select("*")
      .in("status", ["pending", "escalated"])
      .order("created_at", { ascending: false });
    setActiveCalls((data as AndonCall[]) || []);
  }, []);

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
  }, [enabled, loadActive]);

  const acknowledgeCall = useCallback(async (id: string, acknowledgedBy?: string | null) => {
    setActiveCalls((prev) => prev.filter((c) => c.id !== id));
    await supabase
      .from("andon_calls")
      .update({
        status: "acknowledged",
        acknowledged_by: acknowledgedBy || null,
        acknowledged_at: new Date().toISOString(),
      })
      .eq("id", id);
  }, []);

  return { activeCalls, acknowledgeCall };
}

// Hook: daftar mesin yang di-lead oleh user ini (semua tier) — dipakai
// untuk memfilter overlay alert supaya cuma muncul ke leader mesin
// bersangkutan, bukan semua admin/leader.
export function useMyLedMesin(userId: string | null | undefined) {
  const [ledMesin, setLedMesin] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) {
      setLedMesin(new Set());
      return;
    }
    let cancelled = false;
    supabase
      .from("andon_leaders")
      .select("mesin")
      .eq("user_id", userId)
      .then(({ data }) => {
        if (cancelled) return;
        setLedMesin(new Set((data || []).map((r: any) => r.mesin as string)));
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return ledMesin;
}

// Hook untuk full-screen alert (AndonAlertOverlay): panggilan aktif YANG
// CUMA UNTUK mesin yang di-lead user ini, satu per satu (queue), sesuai
// perilaku vanilla — tidak seperti useAndonAlerts (dipakai tabel admin di
// /andon-settings) yang menampilkan SEMUA panggilan aktif ke semua
// admin/leader tanpa filter tier.
export function useAndonLeaderAlerts(userId: string | null | undefined) {
  const ledMesin = useMyLedMesin(userId);
  const [queue, setQueue] = useState<AndonCall[]>([]);
  const channelNameRef = useRef(
    `andon_leader_alerts_${Math.random().toString(36).slice(2)}`
  );

  const loadPending = useCallback(async () => {
    if (ledMesin.size === 0) {
      setQueue([]);
      return;
    }
    const { data } = await supabase
      .from("andon_calls")
      .select("*")
      .in("status", ["pending", "escalated"])
      .in("mesin", Array.from(ledMesin))
      .order("created_at", { ascending: true });
    setQueue((data as AndonCall[]) || []);
  }, [ledMesin]);

  useEffect(() => {
    if (ledMesin.size === 0) {
      setQueue([]);
      return;
    }
    loadPending();

    const channel = supabase
      .channel(channelNameRef.current)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "andon_calls" },
        () => loadPending()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ledMesin, loadPending]);

  const acknowledge = useCallback(
    async (id: string) => {
      setQueue((prev) => prev.filter((c) => c.id !== id));
      await supabase
        .from("andon_calls")
        .update({
          status: "acknowledged",
          acknowledged_by: userId || null,
          acknowledged_at: new Date().toISOString(),
        })
        .eq("id", id);
    },
    [userId]
  );

  return { current: queue[0] || null, queueLength: queue.length, acknowledge };
}

// Hook untuk halaman /andon-settings: kelola pendaftaran leader (mesin +
// tier) milik user yang sedang login.
export function useAndonLeaders(userId: string | null | undefined) {
  const [myLeaders, setMyLeaders] = useState<AndonLeader[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMyLeaders = useCallback(async () => {
    if (!userId) {
      setMyLeaders([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("andon_leaders")
      .select("*")
      .eq("user_id", userId)
      .order("mesin");
    setMyLeaders((data as AndonLeader[]) || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchMyLeaders();
  }, [fetchMyLeaders]);

  const daftarLeader = useCallback(
    async (mesin: string, tier: 1 | 2): Promise<{ error: string | null }> => {
      if (!userId) return { error: "Belum login." };
      const { error } = await supabase
        .from("andon_leaders")
        .insert({ user_id: userId, mesin, tier });
      if (error) {
        await fetchMyLeaders();
        return { error: error.code === "23505" ? "Sudah terdaftar utk line & tier ini." : error.message };
      }
      await fetchMyLeaders();
      return { error: null };
    },
    [userId, fetchMyLeaders]
  );

  const hapusLeader = useCallback(
    async (id: string) => {
      await supabase.from("andon_leaders").delete().eq("id", id);
      await fetchMyLeaders();
    },
    [fetchMyLeaders]
  );

  return { myLeaders, loading, daftarLeader, hapusLeader };
}
