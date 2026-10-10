import type { Band } from "../util/time";
import { getH3 } from "../util/h3";
import { BANDS, Reason, type CellFeatures, type Confidence, type SafetyClass, type ScoredCell } from "./types";

type W = Record<"light" | "road" | "act_day" | "act_night" | "help" | "transit" | "built", number>;
export const WEIGHTS: Record<Band, W> = {
  day:     { light: .05, road: .15, act_day: .30, act_night: 0,   help: .15, transit: .15, built: .20 },
  evening: { light: .25, road: .10, act_day: .15, act_night: .15, help: .15, transit: .15, built: .05 },
  night:   { light: .30, road: .15, act_day: 0,   act_night: .25, help: .20, transit: .05, built: .05 },
};
export const ISO_PENALTY: Record<Band, number> = { day: .25, evening: .30, night: .40 };
export const LOW_CONF_PENALTY = 5;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Evening is dark enough that parks/open land count as isolating (uses iso_night). */
export function isoFor(f: CellFeatures, band: Band) {
  return band === "day" ? f.iso_day : f.iso_night;
}

export function rawScore(f: CellFeatures, band: Band): number {
  const w = WEIGHTS[band];
  const positive = (Object.keys(w) as (keyof W)[]).reduce((s, k) => s + w[k] * f[k], 0);
  return clamp(positive - ISO_PENALTY[band] * isoFor(f, band), 0, 1);
}

export function classify(s: number): SafetyClass {
  return s >= 65 ? "COMFORTABLE" : s >= 40 ? "STAY_ALERT" : "EXTRA_CARE";
}

export function confidenceOf(f: CellFeatures): Confidence {
  if (f.light_tagged_frac >= 0.4 && f.poi_any) return 2;
  if (f.light_tagged_frac < 0.1 && f.poi_k1 === 0) return 0;
  return 1;
}

export function reasonsOf(f: CellFeatures, band: Band, confidence: Confidence): number {
  let m = 0;
  if (f.light < 0.4) m |= Reason.UNLIT;
  if (isoFor(f, band) >= 0.4) m |= Reason.ISOLATED;
  if (band !== "day" && f.act_night < 0.2) m |= Reason.NOTHING_OPEN;
  if (f.help < 0.25) m |= Reason.FAR_FROM_HELP;
  if (f.road < 0.45) m |= Reason.NARROW_LANE;
  if (f.act_day < 0.2 && f.built < 0.2) m |= Reason.FEW_PEOPLE;
  if (confidence === 0) m |= Reason.LOW_DATA;
  if (f.light >= 0.7) m |= Reason.WELL_LIT;
  if (f.act_night >= 0.7) m |= Reason.BUSY_STREET;
  if (f.help >= 0.7) m |= Reason.HELP_NEARBY;
  if (f.transit >= 0.7) m |= Reason.TRANSIT_NEARBY;
  return m;
}

export interface Calibration { a: number; b: number; p5: number; p95: number }

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (i - lo);
}

/** Calibration anchors: city CAL_LO-percentile → 15, CAL_HI-percentile → 90 (see docs/DECISIONS.md). */
export const CAL_LO = 0.03;
export const CAL_HI = 0.95;

/** Per-band affine map anchoring the city's low/high percentiles to 15/90. */
export function calibrate(raws: number[]): Calibration {
  const s = [...raws].sort((x, y) => x - y);
  const p5 = percentile(s, CAL_LO), p95 = percentile(s, CAL_HI);
  const a = p95 > p5 ? 75 / (p95 - p5) : 1;
  return { a, b: 15 - a * p5, p5, p95 };
}

export interface CityScores {
  calibration: Record<Band, Calibration>;
  cells: Map<string, Record<Band, ScoredCell>>;
}

/** Scores every cell for every band: raw → calibrate → smooth → confidence penalty. */
export function scoreCity(features: CellFeatures[]): CityScores {
  const byId = new Map(features.map((f) => [f.h3, f]));
  const calibration = {} as Record<Band, Calibration>;
  const cells = new Map<string, Record<Band, ScoredCell>>();
  for (const f of features) cells.set(f.h3, {} as Record<Band, ScoredCell>);

  for (const band of BANDS) {
    const raws = features.map((f) => rawScore(f, band));
    const cal = (calibration[band] = calibrate(raws));
    const cs = new Map(features.map((f, i) => [f.h3, clamp(cal.a * raws[i]! + cal.b, 0, 100)]));
    for (const f of features) {
      const nbs = getH3().gridDisk(f.h3, 1).filter((n) => n !== f.h3 && byId.has(n));
      const own = cs.get(f.h3)!;
      let s = nbs.length ? 0.6 * own + 0.4 * (nbs.reduce((t, n) => t + cs.get(n)!, 0) / nbs.length) : own;
      const confidence = confidenceOf(f);
      if (confidence === 0) s -= LOW_CONF_PENALTY;
      s = Math.round(clamp(s, 0, 100));
      cells.get(f.h3)![band] = { score: s, cls: classify(s), confidence, reasons: reasonsOf(f, band, confidence) };
    }
  }
  return { calibration, cells };
}

/** Single-cell scoring with an existing calibration (no smoothing) — used by tests and runtime what-ifs. */
export function scoreCell(f: CellFeatures, band: Band, cal: Calibration): ScoredCell {
  const confidence = confidenceOf(f);
  let s = clamp(cal.a * rawScore(f, band) + cal.b, 0, 100);
  if (confidence === 0) s -= LOW_CONF_PENALTY;
  s = Math.round(clamp(s, 0, 100));
  return { score: s, cls: classify(s), confidence, reasons: reasonsOf(f, band, confidence) };
}
