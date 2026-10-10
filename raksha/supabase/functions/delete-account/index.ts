// "Delete all my data": removes her evidence objects and the auth user (FK cascades remove every row).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { persistSession: false } });
  const { data: u } = await asUser.auth.getUser();
  if (!u.user) return json({ error: "unauthorized" }, 401);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  // evidence lives under <uid>/<sos_id>/<seq>.<ext>
  const prefix = u.user.id;
  const { data: folders } = await admin.storage.from("evidence").list(prefix);
  const paths: string[] = [];
  for (const f of folders ?? []) {
    const { data: files } = await admin.storage.from("evidence").list(`${prefix}/${f.name}`);
    for (const file of files ?? []) paths.push(`${prefix}/${f.name}/${file.name}`);
    if (!f.id) continue; // a file directly under the uid folder
    paths.push(`${prefix}/${f.name}`);
  }
  if (paths.length) await admin.storage.from("evidence").remove(paths);

  await asUser.rpc("delete_my_data");
  const { error } = await admin.auth.admin.deleteUser(u.user.id);
  if (error) return json({ error: "delete_failed" }, 500);
  return json({ ok: true });
});
