import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getH3, initH3, type Aggregate, type Band, type Report, type SosMode, type SosTrigger } from "@raksha/core";
import { useSettings } from "../../store/settings";
import { edgeShareView } from "../shareClient";
import type { Backend, LivePoint, ShareStart, ShareView, SosStart, TrustedContact } from "./types";

const URL = import.meta.env.VITE_SUPABASE_URL as string;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/** Map the stable RPC error prefixes (see supabase/migrations/0003_rpc.sql) to human text. */
function friendly(e: { message?: string } | null): Error {
  const m = e?.message ?? "";
  const known: Record<string, string> = {
    circle_full: "Your circle can hold up to 5 contacts.", rate_limited: "You've reached today's report limit.",
    duplicate: "You already reported this spot recently.", too_far: "You need to be near this spot to report it.",
    note_too_long: "That note is too long.", not_found: "Not found.",
  };
  const key = Object.keys(known).find((k) => m.includes(k));
  return new Error(key ? known[key]! : m || "Something went wrong");
}
const must = <T>(r: { data: T; error: { message?: string } | null }): T => { if (r.error) throw friendly(r.error); return r.data; };

/** Supabase mode: anonymous sign-in, RLS-protected tables, RPCs for everything that must be validated. */
export class SupabaseBackend implements Backend {
  readonly kind = "supabase" as const;
  private sb: SupabaseClient = createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  private uid?: string;

  async signIn() {
    let { data: { session } } = await this.sb.auth.getSession();
    if (!session) {
      const r = await this.sb.auth.signInAnonymously();
      if (r.error) throw friendly(r.error);
      session = r.data.session;
    }
    this.uid = session!.user.id;
    await this.sb.from("profiles").upsert({ id: this.uid, display_name: (useSettings.getState().name || "friend").slice(0, 40) });
    return { userId: this.uid };
  }

  async getCircle(): Promise<TrustedContact[]> {
    const rows = must(await this.sb.from("trusted_contacts").select("id, name, phone, relation").order("created_at"));
    return (rows ?? []).map((r) => ({ id: r.id, name: r.name, phone: r.phone, relation: r.relation ?? undefined }));
  }
  async saveContact(c: Omit<TrustedContact, "id"> & { id?: string }): Promise<TrustedContact> {
    const row = { name: c.name, phone: c.phone, relation: c.relation ?? null };
    const r = c.id
      ? must(await this.sb.from("trusted_contacts").update(row).eq("id", c.id).select("id").single())
      : must(await this.sb.from("trusted_contacts").insert({ ...row, user_id: this.uid! }).select("id").single());
    return { ...c, id: r!.id };
  }
  async deleteContact(id: string) { must(await this.sb.from("trusted_contacts").delete().eq("id", id)); }

  async startShare(kind: "live" | "walk", minutes: number): Promise<ShareStart> {
    const r = must(await this.sb.rpc("start_share", { p_kind: kind, p_minutes: minutes })) as { session_id: string; token: string };
    return { sessionId: r.session_id, token: r.token };
  }
  async endShare(sessionId: string) { must(await this.sb.rpc("end_share", { p_session_id: sessionId })); }
  async pushPoint(sessionId: string, p: LivePoint) {
    // recorded_at is server-side (default now()), so a client clock can't rewrite history
    must(await this.sb.from("location_points").insert({ session_id: sessionId, user_id: this.uid!, geog: `SRID=4326;POINT(${p.lng} ${p.lat})`, accuracy_m: Math.max(0, p.accuracy), battery: p.battery ?? null }));
  }
  async startSos(trigger: SosTrigger, mode: SosMode): Promise<SosStart> {
    const r = must(await this.sb.rpc("start_sos", { p_trigger: trigger, p_mode: mode })) as { sos_id: string; session_id: string; token: string };
    return { sosId: r.sos_id, sessionId: r.session_id, token: r.token };
  }
  async resolveSos(sosId: string, duress: boolean) { must(await this.sb.rpc("resolve_sos", { p_sos_id: sosId, p_duress: duress })); }

  async submitReport(r: Omit<Report, "createdAt">, position?: { lat: number; lng: number }) {
    await initH3();
    const [cLat, cLng] = getH3().cellToLatLng(r.h3);
    const here = position ?? { lat: cLat, lng: cLng }; // no GPS: the distance check can't help, only the rate limits do
    must(await this.sb.rpc("submit_report", { p_lat: here.lat, p_lng: here.lng, p_cell_lat: cLat, p_cell_lng: cLng, p_h3_cell: r.h3, p_band: r.band, p_category: r.category, p_note: null }));
  }
  async getAggregates(cells: string[]) {
    const out = new Map<string, Record<Band, Aggregate>>();
    for (let i = 0; i < cells.length; i += 500) {
      const rows = must(await this.sb.rpc("get_report_aggregates", { p_cells: cells.slice(i, i + 500) })) as { h3_cell: string; band: Band; neg_w: number; pos_w: number }[];
      for (const r of rows) {
        const e = out.get(r.h3_cell) ?? { day: { neg: 0, pos: 0 }, evening: { neg: 0, pos: 0 }, night: { neg: 0, pos: 0 } };
        e[r.band] = { neg: r.neg_w, pos: r.pos_w };
        out.set(r.h3_cell, e);
      }
    }
    return out;
  }

  async uploadEvidence(sosId: string, seq: number, blob: Blob, durationS?: number) {
    const ext = blob.type.includes("mp4") ? "mp4" : "webm";
    const path = `${this.uid}/${sosId}/${seq}.${ext}`;
    const up = await this.sb.storage.from("evidence").upload(path, blob, { contentType: blob.type || "audio/webm", upsert: true });
    if (up.error) throw friendly(up.error);
    must(await this.sb.from("evidence_clips").upsert({ sos_id: sosId, user_id: this.uid!, storage_path: path, seq, duration_s: durationS ?? 10 }, { onConflict: "sos_id,seq" }));
  }

  getShareView(token: string): Promise<ShareView | null> { return edgeShareView(token); }
  subscribeShare(token: string, cb: () => void) { const i = setInterval(cb, 3000); void token; return () => clearInterval(i); }

  async deleteMyData() {
    const { data: { session } } = await this.sb.auth.getSession();
    // evidence objects + auth user + (via cascade) every row; falls back to the RPC if the function isn't deployed
    const r = await fetch(`${URL}/functions/v1/delete-account`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${session?.access_token ?? KEY}` } }).catch(() => null);
    if (!r?.ok) must(await this.sb.rpc("delete_my_data"));
    await this.sb.auth.signOut();
  }
}
