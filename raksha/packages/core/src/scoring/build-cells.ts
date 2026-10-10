/** CLI: build-cells <features.json> <outDir>  → outDir/cells.json + outDir/meta.json */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { scoreCity } from "./score";
import { BANDS, type CellFeatures } from "./types";

import { initH3 } from "../util/h3";
await initH3();
const [, , featPath, outDir] = process.argv;
if (!featPath || !outDir) { console.error("usage: build-cells <features.json> <outDir>"); process.exit(2); }

const src = JSON.parse(readFileSync(featPath, "utf8")) as {
  city: string; name: string; bbox: number[]; res: number; generated_at: string; cells: CellFeatures[];
};
const { calibration, cells } = scoreCity(src.cells);

const rows = src.cells.map((f) => {
  const c = cells.get(f.h3)!;
  // single reasons mask: night reasons (the strictest band) + positives; confidence from the cell
  return [f.h3, BANDS.map((b) => c[b].score), c.night.confidence, c.night.reasons, 0];
});

const dist = Object.fromEntries(BANDS.map((b) => {
  const n = { COMFORTABLE: 0, STAY_ALERT: 0, EXTRA_CARE: 0 };
  for (const c of cells.values()) n[c[b].cls]++;
  const t = src.cells.length;
  return [b, Object.fromEntries(Object.entries(n).map(([k, v]) => [k, +(100 * v / t).toFixed(1)]))];
}));

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "cells.json"), JSON.stringify({ v: 1, res: src.res, city: src.city, cells: rows }));
writeFileSync(join(outDir, "meta.json"), JSON.stringify({
  v: 1, city: src.city, name: src.name, bbox: src.bbox, res: src.res, cellCount: src.cells.length,
  generated_at: src.generated_at, calibration, distributionPct: dist,
  attribution: "© OpenStreetMap contributors (ODbL). Scores are estimates from open map data; conditions can change.",
}, null, 1));

console.log(`${src.cells.length} cells → ${outDir}`);
console.log("class distribution (% of cells):");
console.table(dist);
// Sanity check, not a target: it catches a broken pack (everything red or everything green). Real cities differ a lot — a metro with
// many parks, railway land and sparse opening-hours tags is legitimately ~⅓ "Extra care" at night. We never retune to hit a number.
const nightCare = (dist.night as Record<string, number>).EXTRA_CARE!;
if (nightCare < 3 || nightCare > 50) console.warn(`WARNING: NIGHT EXTRA_CARE ${nightCare}% looks degenerate (expected roughly 3–50%) — check the OSM extract and features`);
