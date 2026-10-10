import { getH3 } from "../util/h3";
import { BANDS, Reason } from "./types";
import type { Band } from "../util/time";

export type ReportCategory =
  | "harassment" | "stalking" | "felt_unsafe" | "poor_lighting" | "no_help_nearby"
  | "well_lit" | "helpful_people" | "felt_safe";

export const CATEGORY_WEIGHT: Record<ReportCategory, number> = {
  harassment: -1.0, stalking: -1.0, felt_unsafe: -0.7, poor_lighting: -0.5, no_help_nearby: -0.4,
  well_lit: 0.5, helpful_people: 0.6, felt_safe: 0.7,
};

export const COMMUNITY = {
  halfLifeDays: 45,        // contribution = |w|·exp(−age/45)
  maxAgeDays: 120,
  otherBandFactor: 0.3,
  priorStrength: 3,
  maxAdjust: 25,
  spread: 0.5,
  reportsReasonThreshold: 1.5,
} as const;

export interface Report { h3: string; band: Band; category: ReportCategory; createdAt: number }
export interface Aggregate { neg: number; pos: number }

const DAY_MS = 86_400_000;

/** Decayed contribution of one report to one target band; null if it does not apply. */
export function contribution(r: Pick<Report, "band" | "category" | "createdAt">, target: Band, now: number): Aggregate | null {
  const ageDays = (now - r.createdAt) / DAY_MS;
  if (ageDays > COMMUNITY.maxAgeDays) return null;
  if (r.category === "poor_lighting" && target === "day") return null;
  const w = CATEGORY_WEIGHT[r.category];
  const bandFactor = r.band === target ? 1 : COMMUNITY.otherBandFactor;
  const mag = Math.abs(w) * bandFactor * Math.exp(-Math.max(0, ageDays) / COMMUNITY.halfLifeDays);
  return w < 0 ? { neg: mag, pos: 0 } : { neg: 0, pos: mag };
}

/** Local-mode equivalent of the server's get_report_aggregates. */
export function aggregate(reports: Report[], now: number): Map<string, Record<Band, Aggregate>> {
  const out = new Map<string, Record<Band, Aggregate>>();
  for (const r of reports) {
    const row = out.get(r.h3) ?? { day: { neg: 0, pos: 0 }, evening: { neg: 0, pos: 0 }, night: { neg: 0, pos: 0 } };
    for (const b of BANDS) {
      const c = contribution(r, b, now);
      if (c) { row[b].neg += c.neg; row[b].pos += c.pos; }
    }
    out.set(r.h3, row);
  }
  return out;
}

/** Points delta (−25..+25) for a cell's aggregate. One report can never flip a cell (prior strength 3). */
export function adjustment(a: Aggregate): number {
  return (-COMMUNITY.maxAdjust * (a.neg - a.pos)) / (a.neg + a.pos + COMMUNITY.priorStrength) + 0; // + 0 normalises -0
}

export type Adjustments = Map<string, Record<Band, { delta: number; reports: boolean }>>;

/** Per-cell adjustment field including the 0.5× spill onto k=1 neighbours. */
export function adjustmentField(aggs: Map<string, Record<Band, Aggregate>>): Adjustments {
  const out: Adjustments = new Map();
  const slot = (h: string) => {
    let v = out.get(h);
    if (!v) { v = { day: { delta: 0, reports: false }, evening: { delta: 0, reports: false }, night: { delta: 0, reports: false } }; out.set(h, v); }
    return v;
  };
  for (const [cell, row] of aggs) {
    for (const b of BANDS) {
      const a = row[b];
      const d = adjustment(a);
      if (d === 0) continue;
      const s = slot(cell)[b];
      s.delta += d;
      if (a.neg >= COMMUNITY.reportsReasonThreshold) s.reports = true;
      for (const n of getH3().gridDisk(cell, 1)) if (n !== cell) slot(n)[b].delta += COMMUNITY.spread * d;
    }
  }
  return out;
}

export const REPORTS_BIT = Reason.REPORTS;
