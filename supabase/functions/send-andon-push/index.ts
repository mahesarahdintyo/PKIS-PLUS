// supabase/functions/send-andon-push/index.ts
// Dipanggil dari frontend setelah insert ke andon_calls (lihat
// hooks/useAndon.ts -> usePanggilLeader), ATAU dari andon-escalate waktu
// eskalasi ke tier 2.
//
// Perlu 2 secret di-set dulu:
//   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=...
// Public key HARUS SAMA PERSIS dengan ANDON_VAPID_PUBLIC_KEY di
// hooks/produksi/useAndon.ts (satu pasang, tidak boleh beda).
// SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY sudah otomatis tersedia bawaan.

import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

webpush.setVapidDetails("mailto:andon@pabrik.local", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// Browser SELALU kirim OPTIONS (preflight) sebelum POST asli waktu function
// dipanggil dari frontend (supabase.functions.invoke). Tanpa ini, function
// langsung 500 di step OPTIONS sebelum sempat proses apa pun.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function sbHeaders() {
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  try {
    const { call_id, tier } = await req.json();
    console.log("send-andon-push dipanggil, call_id:", call_id, "tier:", tier);
    if (!call_id) return new Response(JSON.stringify({ error: "call_id wajib diisi" }), { status: 400, headers: CORS_HEADERS });
    const targetTier = tier || 1;

    const callRes = await fetch(`${SUPABASE_URL}/rest/v1/andon_calls?id=eq.${call_id}&select=*`, { headers: sbHeaders() });
    const calls = await callRes.json();
    const call = calls[0];
    if (!call) { console.log("panggilan tidak ditemukan:", call_id); return new Response(JSON.stringify({ error: "panggilan tidak ditemukan" }), { status: 404, headers: CORS_HEADERS }); }

    const leadersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/andon_leaders?mesin=eq.${call.mesin}&tier=eq.${targetTier}&select=user_id`,
      { headers: sbHeaders() }
    );
    const leaders = await leadersRes.json();
    const userIds: string[] = leaders.map((l: any) => l.user_id);
    console.log("leader tier", targetTier, "utk", call.mesin, ":", userIds.length, "orang");
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0, note: `belum ada leader tier ${targetTier} terdaftar utk ${call.mesin}` }), { headers: CORS_HEADERS });
    }

    const subsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=in.(${userIds.join(",")})&select=*`,
      { headers: sbHeaders() }
    );
    const subs = await subsRes.json();
    console.log("device terdaftar (push_subscriptions):", subs.length);

    const payload = JSON.stringify({
      title: targetTier === 2 ? `🚨 ESKALASI Andon - ${call.mesin}` : `🔔 Panggilan Andon - ${call.mesin}`,
      body: call.alasan ? `Alasan: ${call.alasan}` : "Operator memanggil leader",
      call_id: call.id,
      mesin: call.mesin,
      tier: targetTier,
    });

    let sent = 0, failed = 0;
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          payload
        );
        sent++;
      } catch (e: any) {
        failed++;
        console.log("GAGAL kirim ke", sub.endpoint.slice(0, 60), "status:", e?.statusCode, "pesan:", e?.body || e?.message);
        if (e?.statusCode === 410 || e?.statusCode === 404) {
          // subscription sudah tidak valid (HP uninstall/logout) -- bersihkan
          await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${sub.id}`, {
            method: "DELETE", headers: sbHeaders(),
          });
        }
      }
    }
    console.log("hasil akhir -- sent:", sent, "failed:", failed);
    return new Response(JSON.stringify({ sent, failed }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  } catch (e) {
    console.log("ERROR fatal di send-andon-push:", String(e));
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS_HEADERS });
  }
});
