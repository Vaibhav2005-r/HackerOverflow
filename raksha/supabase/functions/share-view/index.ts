// Public, token-gated read for a contact's live view. verify_jwt = false (contacts have no account).
// The token is 256 bits and only its sha256 is stored; invalid / expired tokens all answer 404 with no detail.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { RateLimiter } from "../_shared/ratelimit.ts";

const limiter = new RateLimiter(2000); // 1 request / 2 s per token

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);

  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!/^[0-9a-f]{64}$/.test(token)) return json({ error: "not_found" }, 404);

  const wait = limiter.check(token);
  if (wait > 0) return json({ error: "rate_limited" }, 429, { "Retry-After": String(Math.ceil(wait / 1000)) });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("share_view_data", { p_token: token });
  if (error || !data) return json({ error: "not_found" }, 404);

  // SOS evidence: short-lived signed URLs (5 min) from the private bucket
  const clips = [];
  for (const c of (data.clips ?? []) as { seq: number; storage_path: string }[]) {
    const { data: signed } = await supabase.storage.from("evidence").createSignedUrl(c.storage_path, 300);
    if (signed?.signedUrl) clips.push({ seq: c.seq, signedUrl: signed.signedUrl });
  }
  return json({ ...data, clips });
});
