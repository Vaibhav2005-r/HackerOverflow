import { classify } from "../scoring/score";
import { Reason, type SafetyClass } from "../scoring/types";
import { UNKNOWN_SCORE, type CellLookup } from "../scoring/lookup";
import { cumulative, haversine, resample, sliceLine, type LngLat } from "../util/geo";
import type { Band } from "../util/time";

export type Mode = "walk" | "vehicle";

export const ROUTE_CONFIG = {
  stepM: { walk: 25, vehicle: 50 },
  minStretchM: 75,
  mergeGapM: 30,
  vehicleDropoffM: 300,
  vehicleDropoffWeight: 2,
  safestMaxSlowdown: 1.35,
  balancedMinutePenalty: 0.8,
  rsi: { mean: 0.45, p10: 0.35, noExtraCare: 0.2, longestDivisor: 40, longestCap: 15 },
} as const;

export interface RouteInput { id: string; coords: LngLat[]; durationS: number; distanceM: number }
export interface MessageRef { key: string; params: Record<string, string | number> }
export interface SafeSpotRef { kind: string; name: string; lat: number; lng: number; "24x7"?: boolean }

export interface Stretch {
  id: string;
  startM: number; endM: number; lengthM: number;
  cls: Exclude<SafetyClass, "COMFORTABLE">;
  reasons: number;            // OR of negative reason bits
  startPt: LngLat; midPt: LngLat; endPt: LngLat;
}

export interface StretchExplanation { stretchId: string; reasonKeys: string[]; tip: MessageRef | null }

export interface RouteAssessment {
  id: string; durationS: number; distanceM: number; coords: LngLat[];
  rsi: number; cls: SafetyClass; mean: number; p10: number;
  extraCareFrac: number; longestExtraCareM: number; litFrac: number; lowDataFrac: number;
  stretches: Stretch[];
  segmentsForMap: { coords: LngLat[]; cls: SafetyClass }[];
}

const NEGATIVE_BITS = [Reason.UNLIT, Reason.ISOLATED, Reason.NOTHING_OPEN, Reason.FAR_FROM_HELP,
  Reason.NARROW_LANE, Reason.FEW_PEOPLE, Reason.REPORTS, Reason.LOW_DATA];

const REASON_KEY: Record<number, string> = {
  [Reason.UNLIT]: "reason.unlit", [Reason.ISOLATED]: "reason.isolated", [Reason.NOTHING_OPEN]: "reason.nothingOpen",
  [Reason.FAR_FROM_HELP]: "reason.farFromHelp", [Reason.NARROW_LANE]: "reason.narrowLane",
  [Reason.FEW_PEOPLE]: "reason.fewPeople", [Reason.REPORTS]: "reason.reports", [Reason.LOW_DATA]: "reason.lowData",
};

const negativeOnly = (m: number) => m & ((1 << 8) - 1);

function weightedPercentile(values: number[], weights: number[], p: number): number {
  if (!values.length) return 0;
  const idx = values.map((_, i) => i).sort((a, b) => values[a]! - values[b]!);
  const total = weights.reduce((s, w) => s + w, 0);
  let acc = 0;
  for (const i of idx) {
    acc += weights[i]!;
    if (acc >= p * total) return values[i]!;
  }
  return values[idx.at(-1)!]!;
}

export function assessRoute(route: RouteInput, band: Band, lookup: CellLookup, mode: Mode = "walk"): RouteAssessment {
  const step = ROUTE_CONFIG.stepM[mode];
  const samples = resample(route.coords, step);
  const total = samples.at(-1)?.endM ?? 0;
  const cum = cumulative(route.coords);

  const scores: number[] = [], classes: SafetyClass[] = [], reasons: number[] = [], w: number[] = [];
  for (const s of samples) {
    const info = lookup(s.pt[1], s.pt[0], band);
    const score = info?.score ?? UNKNOWN_SCORE;
    scores.push(score);
    classes.push(info ? info.cls : classify(UNKNOWN_SCORE));
    reasons.push(info ? info.reasons : Reason.LOW_DATA);
    const dropoff = mode === "vehicle" && s.distM >= total - ROUTE_CONFIG.vehicleDropoffM;
    w.push(s.lenM * (dropoff ? ROUTE_CONFIG.vehicleDropoffWeight : 1));
  }

  const sumW = w.reduce((a, b) => a + b, 0) || 1;
  const mean = scores.reduce((a, sc, i) => a + sc * w[i]!, 0) / sumW;
  const p10 = weightedPercentile(scores, w, 0.1);
  const extraW = classes.reduce((a, c, i) => a + (c === "EXTRA_CARE" ? w[i]! : 0), 0);
  const extraCareFrac = extraW / sumW;

  let longest = 0, run = 0;
  classes.forEach((c, i) => { run = c === "EXTRA_CARE" ? run + samples[i]!.lenM : 0; longest = Math.max(longest, run); });

  const totalLen = samples.reduce((a, s) => a + s.lenM, 0) || 1;
  // "well-lit" is claimed only where the cell's light score is ≥ 0.7 (explicit tag or a major road), never from default priors
  const wellLit = samples.reduce((a, s, i) => a + (reasons[i]! & Reason.WELL_LIT ? s.lenM : 0), 0);
  const lowData = samples.reduce((a, s, i) => a + (reasons[i]! & Reason.LOW_DATA ? s.lenM : 0), 0);

  const k = ROUTE_CONFIG.rsi;
  const rsi = Math.min(100, Math.max(0,
    k.mean * mean + k.p10 * p10 + k.noExtraCare * 100 * (1 - extraCareFrac)
    - Math.min(k.longestCap, longest / k.longestDivisor)));

  // stretches: contiguous non-comfortable runs, merged across tiny gaps, ≥ 75 m
  type Run = { a: number; b: number };
  const runs: Run[] = [];
  classes.forEach((c, i) => {
    if (c === "COMFORTABLE") return;
    const last = runs.at(-1);
    if (last && last.b === i - 1) last.b = i; else runs.push({ a: i, b: i });
  });
  const merged: Run[] = [];
  for (const r of runs) {
    const prev = merged.at(-1);
    const gap = prev ? samples[r.a]!.startM - samples[prev.b]!.endM : Infinity;
    if (prev && gap <= Math.max(ROUTE_CONFIG.mergeGapM, step)) prev.b = r.b; else merged.push({ ...r });
  }
  const stretches: Stretch[] = [];
  for (const r of merged) {
    const startM = samples[r.a]!.startM, endM = samples[r.b]!.endM;
    if (endM - startM < ROUTE_CONFIG.minStretchM) continue;
    let rs = 0, worst: Stretch["cls"] = "STAY_ALERT";
    for (let i = r.a; i <= r.b; i++) { rs |= negativeOnly(reasons[i]!); if (classes[i] === "EXTRA_CARE") worst = "EXTRA_CARE"; }
    const seg = sliceLine(route.coords, cum, startM, endM);
    stretches.push({
      id: `${route.id}:${stretches.length}`, startM, endM, lengthM: endM - startM, cls: worst, reasons: rs,
      startPt: seg[0]!, endPt: seg.at(-1)!, midPt: sliceLine(route.coords, cum, (startM + endM) / 2, (startM + endM) / 2)[0]!,
    });
  }

  // colour segments for the map: consecutive samples of the same class
  const segmentsForMap: RouteAssessment["segmentsForMap"] = [];
  let from = 0;
  for (let i = 1; i <= samples.length; i++) {
    if (i === samples.length || classes[i] !== classes[from]) {
      segmentsForMap.push({ coords: sliceLine(route.coords, cum, samples[from]!.startM, samples[i - 1]!.endM), cls: classes[from]! });
      from = i;
    }
  }

  return {
    id: route.id, durationS: route.durationS, distanceM: route.distanceM, coords: route.coords,
    rsi, cls: classify(rsi), mean, p10, extraCareFrac, longestExtraCareM: longest,
    litFrac: wellLit / totalLen, lowDataFrac: lowData / totalLen, stretches, segmentsForMap,
  };
}

export interface RouteChoice {
  fastest: RouteAssessment;
  safest: RouteAssessment;
  balanced?: RouteAssessment;
  safestMuchLonger: boolean;
}

export function chooseRoutes(routes: RouteAssessment[]): RouteChoice {
  if (!routes.length) throw new Error("no routes");
  const byTime = (a: RouteAssessment, b: RouteAssessment) => a.durationS - b.durationS || a.distanceM - b.distanceM;
  const byRsi = (a: RouteAssessment, b: RouteAssessment) => b.rsi - a.rsi || byTime(a, b);
  const fastest = [...routes].sort(byTime)[0]!;
  const window = routes.filter((r) => r.durationS <= fastest.durationS * ROUTE_CONFIG.safestMaxSlowdown);
  let safest = [...window].sort(byRsi)[0]!;
  let safestMuchLonger = false;
  if (window.length === 1 && routes.length > 1) {
    // no alternative within 1.35× of the fastest: fall back to best RSI overall, flagged
    safest = [...routes].sort(byRsi)[0]!;
    safestMuchLonger = safest.id !== fastest.id;
  }
  const score = (r: RouteAssessment) => r.rsi - ROUTE_CONFIG.balancedMinutePenalty * Math.max(0, (r.durationS - fastest.durationS) / 60);
  const best = [...routes].sort((a, b) => score(b) - score(a) || byTime(a, b))[0]!;
  const balanced = best.id !== fastest.id && best.id !== safest.id ? best : undefined;
  return { fastest, safest, balanced, safestMuchLonger };
}

/** Plain-language trade-off of `r` against the fastest route. */
export function tradeoff(r: RouteAssessment, fastest: RouteAssessment): MessageRef {
  const minutes = Math.round((r.durationS - fastest.durationS) / 60);
  const litPct = Math.round(r.litFrac * 100);
  if (r.id === fastest.id || minutes <= 0) return { key: "route.fastestLit", params: { litPct } };
  return { key: "route.tradeoff", params: { minutes, litPct } };
}

export function explainStretches(a: RouteAssessment, spots: SafeSpotRef[] = []): StretchExplanation[] {
  return a.stretches.map((s) => {
    const reasonKeys = NEGATIVE_BITS.filter((b) => s.reasons & b).map((b) => REASON_KEY[b]!);
    const nearest = (pred: (p: SafeSpotRef) => boolean) => {
      let best: { p: SafeSpotRef; d: number } | undefined;
      for (const p of spots) if (pred(p)) {
        const d = haversine(s.midPt, [p.lng, p.lat]);
        if (!best || d < best.d) best = { p, d };
      }
      return best;
    };
    let tip: MessageRef | null = null;
    if (s.reasons & Reason.UNLIT) tip = { key: "tip.torch", params: {} };
    else if (s.reasons & Reason.ISOLATED) tip = { key: "tip.share", params: {} };
    else if (s.reasons & Reason.NOTHING_OPEN) {
      const n = nearest((p) => p.kind !== "fuel" || p["24x7"] === true);
      if (n) tip = { key: "tip.openPlace", params: { place: n.p.name } };
    } else if (s.reasons & Reason.FAR_FROM_HELP) {
      const n = nearest((p) => p.kind === "police" || p.kind === "hospital");
      if (n) tip = { key: "tip.helpOffRoute", params: { meters: Math.round(n.d / 10) * 10, place: n.p.name } };
    }
    return { stretchId: s.id, reasonKeys, tip };
  });
}
