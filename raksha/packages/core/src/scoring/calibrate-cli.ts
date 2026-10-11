/** CLI: calibrate <features.json…> <out.json> — one national calibration from many cities' features (per band, P3→15, P95→90). */
import { readFileSync, writeFileSync } from "node:fs";
import { rawScore, calibrate } from "./score";
import { BANDS, type CellFeatures } from "./types";

const args = process.argv.slice(2);
const out = args.pop();
if (!out || args.length === 0) { console.error("usage: calibrate <features.json…> <out.json>"); process.exit(2); }
const raws = Object.fromEntries(BANDS.map((b) => [b, [] as number[]]));
let n = 0;
for (const f of args) {
  for (const c of (JSON.parse(readFileSync(f, "utf8")) as { cells: CellFeatures[] }).cells) { n++; for (const b of BANDS) raws[b]!.push(rawScore(c, b)); }
}
const cal = Object.fromEntries(BANDS.map((b) => [b, calibrate(raws[b]!)]));
writeFileSync(out, JSON.stringify({ v: 1, cells: n, sources: args.length, calibration: cal }, null, 1));
console.log(`calibration from ${n} cells in ${args.length} files →`, JSON.stringify(Object.fromEntries(BANDS.map((b) => [b, { a: +cal[b]!.a.toFixed(2), b: +cal[b]!.b.toFixed(2) }]))));
