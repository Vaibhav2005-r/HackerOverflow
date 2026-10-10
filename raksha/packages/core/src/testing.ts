import type { CellLookup } from "./scoring/lookup";
import { classify } from "./scoring/score";
import type { LngLat } from "./util/geo";

/** Test helpers: a straight east-west world at lat 19.2 where "metres east" is the only dimension. */
export const LAT0 = 19.2, LNG0 = 72.85;
export const M_PER_DEG_LNG = 111_320 * Math.cos((LAT0 * Math.PI) / 180);
export const lngAt = (m: number) => LNG0 + m / M_PER_DEG_LNG;
export const eastM = (lng: number) => (lng - LNG0) * M_PER_DEG_LNG;
export const line = (fromM: number, toM: number, n = 40): LngLat[] =>
  Array.from({ length: n + 1 }, (_, i) => [lngAt(fromM + ((toM - fromM) * i) / n), LAT0] as LngLat);

export interface Zone { from: number; to: number; score: number; reasons?: number }
/** Lookup returning zone scores by metres-east; outside any zone → undefined (unknown cell). */
export const zoneLookup = (zones: Zone[]): CellLookup => (_lat, lng) => {
  const m = eastM(lng);
  const z = zones.find((q) => m >= q.from && m < q.to);
  return z ? { h3: `z${z.from}`, score: z.score, cls: classify(z.score), confidence: 2, reasons: z.reasons ?? 0 } : undefined;
};
