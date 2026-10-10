import type { Aggregate, Band, Report, SosMode, SosTrigger } from "@raksha/core";
import type { AccountInfo, Backend, LivePoint, ShareView, TrustedContact } from "./types";
import { LocalBackend } from "./localAdapter";

const hasKeys = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

/** Picks Supabase when both env vars exist, otherwise local mode (judges' machines). supabase-js loads lazily, only in Supabase mode. */
class LazyBackend implements Backend {
  private mode: "local" | "supabase" = hasKeys ? "supabase" : "local";
  /** Why we dropped to local mode (e.g. anonymous sign-ins disabled, project unreachable); shown in Settings. */
  fallbackReason?: string;
  get kind() { return this.mode; }
  private real: Promise<Backend> = hasKeys ? import("./supabaseAdapter").then((m) => new m.SupabaseBackend()) : Promise.resolve(new LocalBackend());
  private signing?: Promise<{ userId: string }>;
  /** Every call waits for the (single, memoised) sign-in, so nothing can reach a half-ready Supabase client. */
  private b = () => this.signIn().then(() => this.real);

  /** If Supabase can't sign in or its schema isn't there yet, the app keeps working in local mode instead of breaking. */
  signIn() {
    return (this.signing ??= this.real.then((b) => b.signIn()).catch((e: Error) => {
      if (this.mode !== "supabase") throw e;
      console.warn("Supabase unavailable, using local mode:", e.message);
      this.mode = "local"; this.fallbackReason = e.message;
      this.real = Promise.resolve(new LocalBackend());
      return this.real.then((b) => b.signIn());
    }));
  }
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
  accountInfo(): Promise<AccountInfo> { return this.b().then((b) => b.accountInfo()); }
  linkEmail(email: string) { return this.b().then((b) => b.linkEmail(email)); }
  confirmEmail(email: string, code: string) { return this.b().then((b) => b.confirmEmail(email, code)); }
  signInWithEmail(email: string) { return this.b().then((b) => b.signInWithEmail(email)); }
  confirmSignIn(email: string, code: string) { return this.b().then((b) => b.confirmSignIn(email, code)); }
  signOut() { return this.b().then((b) => b.signOut()); }
}

let backend: Backend | null = null;
export function getBackend(): Backend { backend ??= new LazyBackend(); return backend; }
export const backendNotice = () => (backend as LazyBackend | null)?.fallbackReason;
export type { AccountInfo, Backend, TrustedContact, LivePoint, ShareView } from "./types";
