import { describe, expect, it } from "vitest";
import { adjustment, adjustmentField, aggregate, contribution, type Report } from "./community";
import { cellInfo, makeLookup, parseCellsFile, type CellMap } from "./lookup";
import { Reason } from "./types";
import { latLngToCell } from "h3-js";

const NOW = Date.UTC(2026, 9, 10);
const DAY = 86_400_000;
const cell = latLngToCell(19.2, 72.85, 9);
const rep = (category: Report["category"], ageDays = 0, band: Report["band"] = "night"): Report =>
  ({ h3: cell, band, category, createdAt: NOW - ageDays * DAY });

describe("community adjustment", () => {
  it("one harassment report moves a score by < 10 points; five recent ones by > 15", () => {
    const one = adjustment(aggregate([rep("harassment")], NOW).get(cell)!.night);
    const five = adjustment(aggregate(Array.from({ length: 5 }, () => rep("harassment")), NOW).get(cell)!.night);
    expect(Math.abs(one)).toBeLessThan(10);
    expect(Math.abs(five)).toBeGreaterThan(15);
    expect(one).toBeLessThan(0);
  });
  it("positive reports raise, negative lower, and they offset", () => {
    expect(adjustment({ neg: 0, pos: 2 })).toBeGreaterThan(0);
    expect(adjustment({ neg: 2, pos: 2 })).toBe(0);
    expect(adjustment({ neg: 0, pos: 0 })).toBe(0);
  });
  it("decays with age and ignores reports older than 120 days", () => {
    const fresh = contribution(rep("harassment"), "night", NOW)!;
    const old = contribution(rep("harassment", 45), "night", NOW)!;
    expect(old.neg).toBeCloseTo(fresh.neg * Math.exp(-1), 6);
    expect(contribution(rep("harassment", 121), "night", NOW)).toBeNull();
  });
  it("other bands get ×0.3; poor_lighting never applies to DAY", () => {
    expect(contribution(rep("harassment", 0, "night"), "day", NOW)!.neg).toBeCloseTo(0.3, 6);
    expect(contribution(rep("poor_lighting", 0, "night"), "day", NOW)).toBeNull();
    expect(contribution(rep("poor_lighting", 0, "night"), "evening", NOW)!.neg).toBeCloseTo(0.15, 6);
  });
  it("adjustment field spills 0.5× to neighbours and sets the REPORTS flag at neg ≥ 1.5", () => {
    const reports = [rep("harassment"), rep("stalking")];
    const field = adjustmentField(aggregate(reports, NOW));
    const own = field.get(cell)!.night;
    expect(own.reports).toBe(true);
    const neighbour = [...field.entries()].find(([k]) => k !== cell)![1].night;
    expect(neighbour.delta).toBeCloseTo(own.delta * 0.5, 6);
    expect(neighbour.reports).toBe(false);
  });
  it("monotonic: adding a negative never raises, adding a positive never lowers", () => {
    const base = [rep("felt_unsafe"), rep("well_lit")];
    const a0 = adjustment(aggregate(base, NOW).get(cell)!.night);
    const a1 = adjustment(aggregate([...base, rep("harassment")], NOW).get(cell)!.night);
    const a2 = adjustment(aggregate([...base, rep("felt_safe")], NOW).get(cell)!.night);
    expect(a1).toBeLessThanOrEqual(a0);
    expect(a2).toBeGreaterThanOrEqual(a0);
  });
});

describe("cell lookup", () => {
  const file = { v: 1, res: 9, city: "t", cells: [[cell, [70, 60, 50], 2, Reason.WELL_LIT, 0]] as [string, number[], number, number, number][] };
  const { res, cells } = parseCellsFile(file);
  it("reads band scores and applies community delta + REPORTS bit", () => {
    expect(cellInfo(cells, cell, "night")!.score).toBe(50);
    const adj = adjustmentField(aggregate([rep("harassment"), rep("stalking"), rep("harassment")], NOW));
    const info = cellInfo(cells, cell, "night", adj)!;
    expect(info.score).toBeLessThan(50);
    expect(info.reasons & Reason.REPORTS).toBeTruthy();
    expect(info.cls).toBe("EXTRA_CARE");
  });
  it("clamps and handles unknown cells", () => {
    const m: CellMap = new Map([[cell, { scores: [5, 5, 5], confidence: 2, reasons: 0 }]]);
    const big = new Map([[cell, { day: { delta: -50, reports: false }, evening: { delta: 0, reports: false }, night: { delta: 0, reports: false } }]]);
    expect(cellInfo(m, cell, "day", big)!.score).toBe(0);
    expect(cellInfo(m, "nope", "day")).toBeUndefined();
    expect(makeLookup(cells, res)(19.2, 72.85, "day")!.score).toBe(70);
  });
});
