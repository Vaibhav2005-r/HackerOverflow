/** CLI: score-features <features.json> <calibration.json> <rows.json> — score one chunk with the national calibration; rows = cells.json tuples. */
import { readFileSync, writeFileSync } from "node:fs";
import { initH3 } from "../util/h3";
import { scoreCity } from "./score";
import { BANDS, type CellFeatures } from "./types";

await initH3();
const [, , featPath, calPath, outPath] = process.argv;
if (!featPath || !calPath || !outPath) { console.error("usage: score-features <features.json> <calibration.json> <rows.json>"); process.exit(2); }
const feats = (JSON.parse(readFileSync(featPath, "utf8")) as { cells: CellFeatures[] }).cells;
const cal = (JSON.parse(readFileSync(calPath, "utf8")) as { calibration: never }).calibration;
const { cells } = scoreCity(feats, cal);
const rows = feats.map((f) => { const c = cells.get(f.h3)!; return [f.h3, BANDS.map((b) => c[b].score), c.night.confidence, c.night.reasons, 0]; });
writeFileSync(outPath, JSON.stringify(rows));
