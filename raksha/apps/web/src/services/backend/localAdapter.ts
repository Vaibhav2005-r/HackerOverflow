import { del, entries, get, set } from "idb-keyval";
import { aggregate, type Aggregate, type Band, type Report, type SosMode, type SosTrigger } from "@raksha/core";
import type { Backend, LivePoint, ShareStart, ShareView, SosStart, TrustedContact } from "./types";

const CIRCLE_KEY = "raksha:circle";
const REPORTS_KEY = "raksha:reports";
const MAX_CONTACTS = 5;
const TRAIL_MAX = 360;
const CHANNEL = "raksha-share";

interface StoredShare extends ShareView { sessionId: string; token: string; sosId?: string }

const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
const shareKey = (token: string) => `raksha:share:${token}`;

/**
 * Local mode: everything in IndexedDB. The contact view (/s/:token) works in another tab of the same browser,
 * synced with BroadcastChannel — enough for judges to see both sides without any server.
 */
export class LocalBackend implements Backend {
  readonly kind = "local" as const;
  private chan = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL) : null;

  async signIn() {
    let id = await get<string>("raksha:uid");
    if (!id) { id = crypto.randomUUID(); await set("raksha:uid", id); }
    return { userId: id };
  }

  async getCircle() { return (await get<TrustedContact[]>(CIRCLE_KEY)) ?? []; }
  async saveContact(c: Omit<TrustedContact, "id"> & { id?: string }) {
    const list = await this.getCircle();
    const saved: TrustedContact = { ...c, id: c.id ?? crypto.randomUUID() };
    const i = list.findIndex((x) => x.id === saved.id);
    if (i >= 0) list[i] = saved;
    else if (list.length >= MAX_CONTACTS) throw new Error("Circle is limited to 5 contacts");
    else list.push(saved);
    await set(CIRCLE_KEY, list);
    return saved;
  }
  async deleteContact(id: string) { await set(CIRCLE_KEY, (await this.getCircle()).filter((x) => x.id !== id)); }

  private async create(kind: ShareView["kind"], name: string, sosId?: string): Promise<ShareStart> {
    const token = randomToken(), sessionId = crypto.randomUUID();
    const s: StoredShare = { sessionId, token, name, kind, status: "active", coercion: false, startedAt: Date.now(), trail: [], sosId };
    await set(shareKey(token), s);
    await set(`raksha:sess:${sessionId}`, token);
    this.chan?.postMessage(token);
    return { sessionId, token };
  }
  private async byToken(token: string) { return get<StoredShare>(shareKey(token)); }
  private async bySession(sessionId: string) {
    const token = await get<string>(`raksha:sess:${sessionId}`);
    return token ? this.byToken(token) : undefined;
  }
  private async save(s: StoredShare) { await set(shareKey(s.token), s); this.chan?.postMessage(s.token); }

  startShare(kind: "live" | "walk", _minutes: number, name: string) { return this.create(kind, name); }
  async endShare(sessionId: string) {
    const s = await this.bySession(sessionId);
    if (s) await this.save({ ...s, status: "ended" });
  }
  async pushPoint(sessionId: string, p: LivePoint) {
    const s = await this.bySession(sessionId);
    if (!s || s.status === "ended") return;
    await this.save({ ...s, last: p, trail: [...s.trail, p].slice(-TRAIL_MAX) });
  }
  async startSos(_trigger: SosTrigger, _mode: SosMode, name: string): Promise<SosStart> {
    const sosId = crypto.randomUUID();
    const sh = await this.create("sos", name, sosId);
    await set(`raksha:sos:${sosId}`, sh.sessionId);
    return { ...sh, sosId };
  }
  async resolveSos(sosId: string, duress: boolean) {
    const sessionId = await get<string>(`raksha:sos:${sosId}`);
    const s = sessionId ? await this.bySession(sessionId) : undefined;
    if (!s) return;
    // duress: the UI shows "cancelled" but the session stays active and flagged
    await this.save(duress ? { ...s, coercion: true } : { ...s, status: "ended" });
  }

  async submitReport(r: Omit<Report, "createdAt">) {
    const list = (await get<Report[]>(REPORTS_KEY)) ?? [];
    await set(REPORTS_KEY, [...list, { ...r, createdAt: Date.now() }]);
  }
  /** Seeded demo reports (the local twin of supabase/seed.sql) plus anything she filed on this device. */
  private async seed(): Promise<Report[]> {
    if (this.seeded) return this.seeded;
    try {
      const rows = (await (await fetch("/data/mumbai_demo/seed_reports.json")).json()) as { h3: string; band: Band; category: Report["category"]; ageDays: number }[];
      this.seeded = rows.map((r) => ({ h3: r.h3, band: r.band, category: r.category, createdAt: Date.now() - r.ageDays * 86_400_000 }));
    } catch { this.seeded = []; }
    return this.seeded;
  }
  private seeded: Report[] | null = null;
  async getAggregates(cells: string[]): Promise<Map<string, Record<Band, Aggregate>>> {
    const want = new Set(cells);
    const all = [...(await this.seed()), ...((await get<Report[]>(REPORTS_KEY)) ?? [])].filter((r) => want.has(r.h3));
    return aggregate(all, Date.now());
  }
  async uploadEvidence() { /* local mode keeps clips on the device (IndexedDB) */ }

  async getShareView(token: string): Promise<ShareView | null> {
    const s = await this.byToken(token);
    if (!s) return null;
    return { name: s.name, kind: s.kind, status: s.status, coercion: s.coercion, startedAt: s.startedAt, last: s.last, trail: s.trail };
  }
  subscribeShare(token: string, cb: () => void) {
    const ch = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL) : null;
    if (ch) ch.onmessage = (e) => { if (e.data === token) cb(); };
    const poll = setInterval(cb, 3000); // BroadcastChannel can be missed on background tabs
    return () => { ch?.close(); clearInterval(poll); };
  }

  async deleteMyData() {
    for (const [k] of await entries()) if (String(k).startsWith("raksha:")) await del(k);
  }
}
