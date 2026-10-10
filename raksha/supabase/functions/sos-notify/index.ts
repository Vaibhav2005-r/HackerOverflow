// Web Push fan-out to circle members who also use Raksha (P1). The raw share token is never stored, so the caller passes it
// and we verify it matches the SOS session before building the link.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";
import { corsHeaders, json } from "../_shared/cors.ts";

async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: u } = await asUser.auth.getUser();
  if (!u.user) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => null) as { sos_id?: string; token?: string } | null;
  if (!body?.sos_id || !/^[0-9a-f]{64}$/.test(body.token ?? "")) return json({ error: "bad_request" }, 400);

  // ownership via RLS: the caller can only see her own SOS events
  const { data: sos } = await asUser.from("sos_events").select("id, session_id").eq("id", body.sos_id).maybeSingle();
  if (!sos) return json({ error: "not_found" }, 404);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: session } = await admin.from("share_sessions").select("token_hash").eq("id", sos.session_id).single();
  const expected = String(session?.token_hash ?? "").replace(/^\\x/, "");
  if (expected !== await sha256Hex(body.token!)) return json({ error: "not_found" }, 404);

  const { data: profile } = await admin.from("profiles").select("display_name").eq("id", u.user.id).maybeSingle();
  const { data: contacts } = await admin.from("trusted_contacts").select("contact_user_id").eq("user_id", u.user.id).not("contact_user_id", "is", null);
  const ids = (contacts ?? []).map((c) => c.contact_user_id as string);
  if (ids.length === 0) return json({ sent: 0, failed: 0 });
  const { data: subs } = await admin.from("push_subscriptions").select("endpoint, p256dh, auth").in("user_id", ids);

  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") ?? "mailto:hello@raksha.app", Deno.env.get("VITE_VAPID_PUBLIC_KEY") ?? Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);
  const name = profile?.display_name ?? "Someone";
  const payload = JSON.stringify({ title: `${name} needs help`, body: "Open the live link to follow their location.", url: `${Deno.env.get("APP_ORIGIN") ?? ""}/s/${body.token}` });
  let sent = 0, failed = 0;
  for (const s of subs ?? []) {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload); sent++; }
    catch (e) {
      failed++;
      if ((e as { statusCode?: number }).statusCode === 410) await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint); // gone
    }
  }
  return json({ sent, failed });
});
