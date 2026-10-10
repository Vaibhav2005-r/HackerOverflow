import { LocalBackend } from "./backend/localAdapter";
import type { LivePoint, ShareView } from "./backend/types";

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const hasSupabase = Boolean(URL && KEY);

interface EdgeView {
  name: string; kind: ShareView["kind"]; status: ShareView["status"]; coercion: boolean; started_at: number;
  last: LivePoint | null; trail: LivePoint[];
}

/** Contact view data from the `share-view` edge function. Plain fetch: the contact page never loads supabase-js. */
export async function edgeShareView(token: string): Promise<ShareView | null> {
  const r = await fetch(`${URL}/functions/v1/share-view?token=${encodeURIComponent(token)}`, { headers: { apikey: KEY!, Authorization: `Bearer ${KEY}` } });
  if (r.status === 429) throw new Error("rate_limited"); // caller just tries again on the next poll
  if (!r.ok) return null;
  const j = (await r.json()) as EdgeView;
  return { name: j.name, kind: j.kind, status: j.status, coercion: j.coercion, startedAt: j.started_at, last: j.last ?? undefined, trail: j.trail ?? [] };
}

/** What the standalone /s/:token page uses: edge function when configured, otherwise the same-browser local store. */
export function getShareClient() {
  if (hasSupabase) {
    return {
      getShareView: edgeShareView,
      subscribeShare: (_token: string, cb: () => void) => { const i = setInterval(cb, 3000); return () => clearInterval(i); },
    };
  }
  const local = new LocalBackend();
  return { getShareView: (t: string) => local.getShareView(t), subscribeShare: (t: string, cb: () => void) => local.subscribeShare(t, cb) };
}
