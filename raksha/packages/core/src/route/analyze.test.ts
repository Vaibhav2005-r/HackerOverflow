import { describe, expect, it } from "vitest";
import { assessRoute, chooseRoutes, explainStretches, tradeoff, ROUTE_CONFIG, type RouteAssessment } from "./analyze";
import { Reason } from "../scoring/types";
import { line, lngAt, LAT0, zoneLookup, type Zone } from "../testing";

const OK = 80, ALERT = 50, CARE = 20;
const LIT = Reason.WELL_LIT;
const mk = (zones: Zone[], len = 1000, mode: "walk" | "vehicle" = "walk") =>
  assessRoute({ id: "r", coords: line(0, len), durationS: len, distanceM: len }, "night", zoneLookup(zones), mode);

describe("assessRoute", () => {
  const a = mk([{ from: 0, to: 300, score: OK, reasons: LIT }, { from: 300, to: 500, score: CARE, reasons: Reason.UNLIT | Reason.ISOLATED }, { from: 500, to: 2000, score: OK, reasons: LIT }]);

  it("computes metrics and RSI per the formula", () => {
    expect(a.extraCareFrac).toBeCloseTo(0.2, 1);
    expect(a.longestExtraCareM).toBeCloseTo(200, -1);
    expect(a.mean).toBeCloseTo(0.8 * OK + 0.2 * CARE, 0);
    const k = ROUTE_CONFIG.rsi;
    const expected = k.mean * a.mean + k.p10 * a.p10 + k.noExtraCare * 100 * (1 - a.extraCareFrac) - Math.min(15, a.longestExtraCareM / 40);
    expect(a.rsi).toBeCloseTo(expected, 6);
    expect(a.litFrac).toBeCloseTo(0.8, 1);
  });
  it("reports one stretch with merged reasons and geometry", () => {
    expect(a.stretches).toHaveLength(1);
    const s = a.stretches[0]!;
    expect(s.cls).toBe("EXTRA_CARE");
    expect(s.startM).toBeCloseTo(300, -1); expect(s.endM).toBeCloseTo(500, -1);
    expect(s.reasons & Reason.UNLIT).toBeTruthy();
    expect(s.midPt[0]).toBeCloseTo(lngAt(400), 5);
  });
  it("colours map segments by class", () => {
    expect(a.segmentsForMap.map((x) => x.cls)).toEqual(["COMFORTABLE", "EXTRA_CARE", "COMFORTABLE"]);
  });
  it("merges runs separated by a tiny gap but not a large one", () => {
    const tiny = mk([{ from: 0, to: 300, score: CARE }, { from: 300, to: 320, score: OK }, { from: 320, to: 420, score: CARE }, { from: 420, to: 2000, score: OK }]);
    expect(tiny.stretches).toHaveLength(1);
    const wide = mk([{ from: 0, to: 300, score: CARE }, { from: 300, to: 400, score: OK }, { from: 400, to: 520, score: CARE }, { from: 520, to: 2000, score: OK }]);
    expect(wide.stretches).toHaveLength(2);
  });
  it("drops runs shorter than 75 m", () => {
    expect(mk([{ from: 0, to: 400, score: OK }, { from: 400, to: 450, score: CARE }, { from: 450, to: 2000, score: OK }]).stretches).toHaveLength(0);
  });
  it("labels mixed runs by their worst class", () => {
    const m = mk([{ from: 0, to: 200, score: ALERT }, { from: 200, to: 300, score: CARE }, { from: 300, to: 2000, score: OK }]);
    expect(m.stretches[0]!.cls).toBe("EXTRA_CARE");
    expect(mk([{ from: 0, to: 300, score: ALERT }, { from: 300, to: 2000, score: OK }]).stretches[0]!.cls).toBe("STAY_ALERT");
  });
  it("treats unknown cells fail-safe (45, Stay alert, LOW_DATA)", () => {
    const u = mk([]);
    expect(u.mean).toBeCloseTo(45, 5);
    expect(u.lowDataFrac).toBeCloseTo(1, 5);
    expect(u.stretches).toHaveLength(1);
    expect(u.stretches[0]!.reasons & Reason.LOW_DATA).toBeTruthy();
  });
  it("vehicle mode double-weights the last 300 m", () => {
    const zones = [{ from: 0, to: 700, score: OK }, { from: 700, to: 2000, score: CARE }];
    expect(mk(zones, 1000, "vehicle").mean).toBeLessThan(mk(zones, 1000, "walk").mean);
  });
  it("does not claim 'well-lit' for cells that merely lack an UNLIT flag", () => {
    expect(mk([{ from: 0, to: 2000, score: OK, reasons: 0 }]).litFrac).toBe(0);
  });
  it("handles an empty route without throwing", () => {
    const e = assessRoute({ id: "e", coords: [], durationS: 0, distanceM: 0 }, "night", zoneLookup([]));
    expect(e.stretches).toEqual([]);
    expect(e.rsi).toBeGreaterThanOrEqual(0);
  });
});

const fake = (id: string, durationS: number, rsi: number, extra: Partial<RouteAssessment> = {}): RouteAssessment => ({
  id, durationS, distanceM: durationS, coords: [], rsi, cls: "STAY_ALERT", mean: rsi, p10: rsi, extraCareFrac: 0, longestExtraCareM: 0,
  litFrac: 0.9, lowDataFrac: 0, stretches: [], segmentsForMap: [], ...extra,
});

describe("chooseRoutes", () => {
  it("picks fastest, safest within 1.35×, and a distinct balanced route", () => {
    const f = fake("f", 600, 50), a = fake("a", 780, 80), b = fake("b", 900, 90);
    const c = chooseRoutes([b, f, a]);
    expect(c.fastest.id).toBe("f"); expect(c.safest.id).toBe("a");
    expect(c.balanced?.id).toBe("b");
    expect(c.safestMuchLonger).toBe(false);
  });
  it("omits balanced when it equals fastest or safest", () => {
    const c = chooseRoutes([fake("f", 600, 60), fake("a", 650, 80)]);
    expect(c.safest.id).toBe("a"); expect(c.balanced).toBeUndefined();
    expect(chooseRoutes([fake("only", 600, 60)]).balanced).toBeUndefined();
  });
  it("flags 'much longer' when no alternative lies within 1.35×", () => {
    const c = chooseRoutes([fake("f", 600, 40), fake("x", 1000, 85)]);
    expect(c.safest.id).toBe("x"); expect(c.safestMuchLonger).toBe(true);
  });
  it("breaks ties by shorter duration; throws on no routes", () => {
    const c = chooseRoutes([fake("a", 700, 70), fake("b", 650, 70)]);
    expect(c.safest.id).toBe("b");
    expect(() => chooseRoutes([])).toThrow();
  });
});

describe("explanations", () => {
  it("states the trade-off in minutes and lit share", () => {
    expect(tradeoff(fake("a", 840, 80, { litFrac: 0.92 }), fake("f", 600, 50))).toEqual({ key: "route.tradeoff", params: { minutes: 4, litPct: 92 } });
    expect(tradeoff(fake("f", 600, 50, { litFrac: 0.5 }), fake("f", 600, 50)).key).toBe("route.fastestLit");
  });
  it("picks a tip from the dominant reason", () => {
    const spots = [
      { kind: "police", name: "Kandivali PS", lat: LAT0, lng: lngAt(480) },
      { kind: "station", name: "Kandivali Stn", lat: LAT0, lng: lngAt(150) },
    ];
    const run = (reasons: number) => explainStretches(mk([{ from: 0, to: 300, score: OK }, { from: 300, to: 500, score: CARE, reasons }, { from: 500, to: 2000, score: OK }]), spots)[0]!;
    expect(run(Reason.UNLIT).tip?.key).toBe("tip.torch");
    expect(run(Reason.ISOLATED).tip?.key).toBe("tip.share");
    expect(run(Reason.NOTHING_OPEN).tip).toEqual({ key: "tip.openPlace", params: { place: "Kandivali PS" } });
    const far = run(Reason.FAR_FROM_HELP);
    expect(far.tip?.key).toBe("tip.helpOffRoute"); expect(far.tip?.params.meters).toBe(80);
    expect(run(Reason.UNLIT | Reason.NARROW_LANE).reasonKeys).toEqual(["reason.unlit", "reason.narrowLane"]);
    expect(run(Reason.NARROW_LANE).tip).toBeNull();
    expect(explainStretches(mk([{ from: 0, to: 2000, score: ALERT, reasons: Reason.NOTHING_OPEN }]))[0]!.tip).toBeNull();
  });
});
