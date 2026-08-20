// supabase/functions/andon-escalate/index.ts
// Dijalankan otomatis tiap 1 menit lewat pg_cron (bikin dulu schedule-nya
// lewat Supabase Dashboard > Database > Cron Jobs, panggil URL function ini).
// Cari panggilan yang masih 'pending' lebih dari ESCALATE_AFTER_MINUTES,
// tandai 'escalated', lalu kirim push ke leader tier 2.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ESCALATE_AFTER_MINUTES = 5;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function sbHeaders(extra: Record<string, string> = {}) {
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, ...extra };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  const cutoff = new Date(Date.now() - ESCALATE_AFTER_MINUTES * 60000).toISOString();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/andon_calls?status=eq.pending&created_at=lt.${cutoff}&select=id`,
    { headers: sbHeaders() }
  );
  const calls = await res.json();

  let escalated = 0;
  for (const call of calls) {
    await fetch(`${SUPABASE_URL}/rest/v1/andon_calls?id=eq.${call.id}`, {
      method: "PATCH",
      headers: sbHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
      body: JSON.stringify({ status: "escalated", escalated_at: new Date().toISOString() }),
    });
    await fetch(`${SUPABASE_URL}/functions/v1/send-andon-push`, {
      method: "POST",
      headers: sbHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ call_id: call.id, tier: 2 }),
    });
    escalated++;
  }
  return new Response(JSON.stringify({ escalated }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
});
