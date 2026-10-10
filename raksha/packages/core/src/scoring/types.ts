import type { Band } from "../util/time";

export interface CellFeatures {
  h3: string;
  light: number; light_tagged_frac: number; road: number;
  act_day: number; act_night: number; help: number; transit: number; built: number;
  iso_day: number; iso_night: number;
  poi_any: number; poi_k1: number;
}

export type SafetyClass = "COMFORTABLE" | "STAY_ALERT" | "EXTRA_CARE";
export type Confidence = 0 | 1 | 2; // low | medium | high

export const Reason = {
  UNLIT: 1, ISOLATED: 2, NOTHING_OPEN: 4, FAR_FROM_HELP: 8, NARROW_LANE: 16,
  FEW_PEOPLE: 32, REPORTS: 64, LOW_DATA: 128,
  WELL_LIT: 256, BUSY_STREET: 512, HELP_NEARBY: 1024, TRANSIT_NEARBY: 2048,
} as const;

export interface ScoredCell {
  score: number; cls: SafetyClass; confidence: Confidence; reasons: number;
}

export const BANDS: Band[] = ["day", "evening", "night"];
