import type { Aggregate, Band, Report, SosMode, SosTrigger } from "@raksha/core";
import type { Backend, LivePoint, ShareView, TrustedContact } from "./types";
import { LocalBackend } from "./localAdapter";

const hasKeys = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

/** Picks Supabase when both env vars exist, otherwise local mode (judges' machines). supabase-js loads lazily, only in Supabase mode. */
class LazyBackend implements Backend {
  readonly kind = hasKeys ? ("supabase" as const) : ("local" as const);
  private real: Promise<Backend> = hasKeys ? import("./supabaseAdapter").then((m) => new m.SupabaseBackend()) : Promise.resolve(new LocalBackend());
  private b = () => this.real;

  signIn() { return this.b().then((b) => b.signIn()); }
  getCircle() { return this.b().then((b) => b.getCircle()); }
  saveContact(c: Omit<TrustedContact, "id"> & { id?: string }) { return this.b().then((b) => b.saveContact(c)); }
  deleteContact(id: string) { return this.b().then((b) => b.deleteContact(id)); }
  startShare(kind: "live" | "walk", minutes: number, name: string) { return this.b().then((b) => b.startShare(kind, minutes, name)); }
  endShare(id: string) { return this.b().then((b) => b.endShare(id)); }
  pushPoint(id: string, p: LivePoint) { return this.b().then((b) => b.pushPoint(id, p)); }
  startSos(t: SosTrigger, m: SosMode, name: string) { return this.b().then((b) => b.startSos(t, m, name)); }
  resolveSos(id: string, duress: boolean) { return this.b().then((b) => b.resolveSos(id, duress)); }
  submitReport(r: Omit<Report, "createdAt">, pos?: { lat: number; lng: number }) { return this.b().then((b) => b.submitReport(r, pos)); }
  getAggregates(cells: string[]): Promise<Map<string, Record<Band, Aggregate>>> { return this.b().then((b) => b.getAggregates(cells)); }
  uploadEvidence(sosId: string, seq: number, blob: Blob, d?: number) { return this.b().then((b) => b.uploadEvidence(sosId, seq, blob, d)); }
  getShareView(token: string): Promise<ShareView | null> { return this.b().then((b) => b.getShareView(token)); }
  subscribeShare(token: string, cb: () => void) {
    let un: (() => void) | undefined, dead = false;
    void this.b().then((b) => { if (!dead) un = b.subscribeShare(token, cb); });
    return () => { dead = true; un?.(); };
  }
  deleteMyData() { return this.b().then((b) => b.deleteMyData()); }
}

let backend: Backend | null = null;
export function getBackend(): Backend { backend ??= new LazyBackend(); return backend; }
export type { Backend, TrustedContact, LivePoint, ShareView } from "./types";
