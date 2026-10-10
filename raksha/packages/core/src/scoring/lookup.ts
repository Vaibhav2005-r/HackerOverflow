import { getH3 } from "../util/h3";
import { classify } from "./score";
import { Reason, type Confidence, type SafetyClass } from "./types";
import type { Adjustments } from "./community";
import type { Band } from "../util/time";

export interface CellRecord { scores: [number, number, number]; confidence: Confidence; reasons: number }
export type CellMap = Map<string, CellRecord>;
export interface CellInfo { h3: string; score: number; cls: SafetyClass; confidence: Confidence; reasons: number }

export const UNKNOWN_SCORE = 45; // fail-safe: missing data behaves as "Stay alert"
const BAND_INDEX: Record<Band, number> = { day: 0, evening: 1, night: 2 };

export interface CellsFile { v: number; res: number; city: string; cells: [string, number[], number, number, number][] }

export function parseCellsFile(f: CellsFile): { res: number; cells: CellMap } {
  const cells: CellMap = new Map();
  for (const [h3, scores, confidence, reasons] of f.cells) {
    cells.set(h3, { scores: scores as [number, number, number], confidence: confidence as Confidence, reasons });
  }
  return { res: f.res, cells };
}

export function cellInfo(cells: CellMap, h3: string, band: Band, adj?: Adjustments): CellInfo | undefined {
  const rec = cells.get(h3);
  if (!rec) return undefined;
  const a = adj?.get(h3)?.[band];
  const score = Math.round(Math.min(100, Math.max(0, rec.scores[BAND_INDEX[band]]! + (a?.delta ?? 0))));
  return { h3, score, cls: classify(score), confidence: rec.confidence, reasons: rec.reasons | (a?.reports ? Reason.REPORTS : 0) };
}

export type CellLookup = (lat: number, lng: number, band: Band) => CellInfo | undefined;

export function makeLookup(cells: CellMap, res: number, adj?: Adjustments): CellLookup {
  return (lat, lng, band) => cellInfo(cells, getH3().latLngToCell(lat, lng, res), band, adj);
}
