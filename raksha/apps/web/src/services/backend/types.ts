import type { Aggregate, Band, Report, SosMode, SosTrigger } from "@raksha/core";

export interface TrustedContact { id: string; name: string; phone: string; relation?: string }

export interface LivePoint { lat: number; lng: number; accuracy: number; battery?: number; t: number }

export interface ShareStart { sessionId: string; token: string }
export interface SosStart extends ShareStart { sosId: string }

/** What the contact's live view receives (mirrors the share-view edge function). */
export interface ShareView {
  name: string;
  kind: "live" | "walk" | "sos";
  status: "active" | "ended";
  coercion: boolean;
  startedAt: number;
  last?: LivePoint;
  trail: LivePoint[];
}

export interface AccountInfo { supported: boolean; anonymous: boolean; email?: string }

export interface Backend {
  readonly kind: "local" | "supabase";
  signIn(): Promise<{ userId: string }>;
  getCircle(): Promise<TrustedContact[]>;
  saveContact(c: Omit<TrustedContact, "id"> & { id?: string }): Promise<TrustedContact>;
  deleteContact(id: string): Promise<void>;
  startShare(kind: "live" | "walk", minutes: number, name: string): Promise<ShareStart>;
  endShare(sessionId: string): Promise<void>;
  pushPoint(sessionId: string, p: LivePoint): Promise<void>;
  startSos(trigger: SosTrigger, mode: SosMode, name: string): Promise<SosStart>;
  resolveSos(sosId: string, duress: boolean): Promise<void>;
  /** `position` is where she is standing; the server checks it is within 400 m of the cell centre (best-effort anti-spam). */
  submitReport(r: Omit<Report, "createdAt">, position?: { lat: number; lng: number }): Promise<void>;
  /** Decayed community weights per (cell, band). The server never returns reporter ids or notes. */
  getAggregates(cells: string[]): Promise<Map<string, Record<Band, Aggregate>>>;
  uploadEvidence(sosId: string, seq: number, blob: Blob, durationS?: number): Promise<void>;
  getShareView(token: string): Promise<ShareView | null>;
  /** Live updates for the contact view; returns unsubscribe. */
  subscribeShare(token: string, cb: () => void): () => void;
  deleteMyData(): Promise<void>;
  /** Accounts: anonymous by default, upgradable with an email so her circle and history survive a new phone / cleared browser. */
  accountInfo(): Promise<AccountInfo>;
  /** Anonymous → email account. Sends a 6-digit code; `confirmEmail` finishes it (her data stays attached). */
  linkEmail(email: string): Promise<void>;
  confirmEmail(email: string, code: string): Promise<void>;
  /** Existing account on a new device: code by email, then her data is loaded. */
  signInWithEmail(email: string): Promise<void>;
  confirmSignIn(email: string, code: string): Promise<void>;
  signOut(): Promise<void>;
}
