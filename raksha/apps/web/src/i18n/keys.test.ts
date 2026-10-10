import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { en } from "./en";
import { hi } from "./hi";

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) ? [p] : []; });
const read = (files: string[]) => files.map((f) => readFileSync(f, "utf8")).join("\n");

const webSrc = read(walk(new URL("..", import.meta.url).pathname));
const coreSrc = read(walk(new URL("../../../../packages/core/src", import.meta.url).pathname));
const dict = en as Record<string, string>;

describe("i18n completeness (shipped language: en)", () => {
  it("every literal t(\"key\") used in the UI exists", () => {
    const used = [...webSrc.matchAll(/\bt\(\s*"([A-Za-z0-9_.]+)"/g)].map((m) => m[1]!);
    expect(used.length).toBeGreaterThan(100);
    expect(used.filter((k) => !(k in dict))).toEqual([]);
  });

  it("every key that core emits for the UI (reasons, tips, route copy) exists", () => {
    const emitted = [...coreSrc.matchAll(/"((?:reason|tip|route)\.[A-Za-z]+)"/g)].map((m) => m[1]!);
    expect(emitted.length).toBeGreaterThan(8);
    expect([...new Set(emitted)].filter((k) => !(k in dict))).toEqual([]);
  });

  it("dynamic key families are fully defined", () => {
    const families: Record<string, string[]> = {
      class: ["COMFORTABLE", "STAY_ALERT", "EXTRA_CARE"], "class.hint": ["COMFORTABLE", "STAY_ALERT", "EXTRA_CARE"],
      band: ["day", "evening", "night"], conf: ["0", "1", "2"], route: ["safest", "balanced", "fastest"],
      checkin: ["stopped", "offroute", "timer"], plan: ["walk", "vehicle"],
      report: ["harassment", "stalking", "felt_unsafe", "poor_lighting", "no_help_nearby", "well_lit", "helpful_people", "felt_safe"],
    };
    const missing = Object.entries(families).flatMap(([p, ks]) => ks.map((k) => `${p}.${k}`)).filter((k) => !(k in dict));
    expect(missing).toEqual([]);
  });

  it("Hindi has exactly the English keys, and every placeholder survives translation", () => {
    expect(Object.keys(hi).sort()).toEqual(Object.keys(en).sort());
    const ph = (v: string) => (v.match(/\{\w+\}/g) ?? []).sort().join(",");
    const bad = Object.keys(en).filter((k) => ph((en as Record<string, string>)[k]!) !== ph((hi as Record<string, string>)[k]!));
    expect(bad).toEqual([]);
  });

  it("every placeholder in a string is a simple {word}", () => {
    for (const [k, v] of Object.entries(dict)) expect(v.replace(/\{\w+\}/g, ""), k).not.toMatch(/[{}]/);
  });
});
