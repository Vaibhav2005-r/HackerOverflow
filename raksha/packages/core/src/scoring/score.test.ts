import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { calibrate, classify, rawScore, scoreCell, scoreCity, type Calibration } from "./score";
import { Reason, type CellFeatures } from "./types";

// Calibration taken from the generated mumbai_demo meta.json (night band).
const CAL: Calibration = { a: 105, b: 15, p5: 0, p95: 0.714 };
const base: CellFeatures = {
  h3: "89608b444c3ffff", light: 0, light_tagged_frac: 0.5, road: 0, act_day: 0, act_night: 0, help: 0,
  transit: 0, built: 0, iso_day: 0, iso_night: 0, poi_any: 1, poi_k1: 3,
};
const busyLit: CellFeatures = { ...base, light: 1, road: 1, act_day: 0.9, act_night: 0.8, help: 0.9, transit: 0.8, built: 0.8 };
const remoteTrack: CellFeatures = { ...base, light: 0, road: 0.15, iso_day: 1, iso_night: 1, light_tagged_frac: 0.5 };

describe("golden cells", () => {
  it("lit primary road near police and open shops is COMFORTABLE at night", () => {
    const s = scoreCell(busyLit, "night", CAL);
    expect(s.cls).toBe("COMFORTABLE");
    expect(s.reasons & Reason.WELL_LIT).toBeTruthy();
  });
  it("unlit track inside industrial land is EXTRA_CARE at night with reasons", () => {
    const s = scoreCell(remoteTrack, "night", CAL);
    expect(s.cls).toBe("EXTRA_CARE");
    for (const r of [Reason.UNLIT, Reason.ISOLATED, Reason.NOTHING_OPEN, Reason.FAR_FROM_HELP, Reason.NARROW_LANE])
      expect(s.reasons & r).toBeTruthy();
  });
  it("a daytime market with nothing open late scores higher by day than by night (same calibration)", () => {
    const market: CellFeatures = { ...base, light: 0.5, road: 0.65, act_day: 1, act_night: 0.05, built: 0.9, transit: 0.5, help: 0.3 };
    expect(rawScore(market, "day")).toBeGreaterThan(rawScore(market, "night"));
  });
});

describe("confidence", () => {
  it("low confidence is flagged, penalised and gets LOW_DATA", () => {
    const f = { ...busyLit, light_tagged_frac: 0.05, poi_k1: 0, poi_any: 0 };
    const hi = scoreCell({ ...busyLit, light_tagged_frac: 0.9 }, "night", CAL);
    const lo = scoreCell(f, "night", CAL);
    expect(hi.confidence).toBe(2); expect(lo.confidence).toBe(0);
    expect(lo.score).toBe(Math.min(100, hi.score) - 5 >= 0 ? Math.max(0, Math.min(100, Math.round(105 * rawScore(f, "night") + 15)) - 5) : 0);
    expect(lo.reasons & Reason.LOW_DATA).toBeTruthy();
  });
});

describe("calibration", () => {
  it("maps low anchor → 15 and p95 → 90", () => {
    const raws = Array.from({ length: 101 }, (_, i) => i / 100);
    const c = calibrate(raws);
    expect(c.a * c.p95 + c.b).toBeCloseTo(90, 5);
    expect(c.a * c.p5 + c.b).toBeCloseTo(15, 5);
  });
});

describe("classify thresholds", () => {
  it.each([[100, "COMFORTABLE"], [65, "COMFORTABLE"], [64, "STAY_ALERT"], [40, "STAY_ALERT"], [39, "EXTRA_CARE"], [0, "EXTRA_CARE"]])(
    "%i → %s", (s, c) => expect(classify(s)).toBe(c));
});

describe("monotonicity (properties)", () => {
  const unit = fc.double({ min: 0, max: 1, noNaN: true });
  const feat = fc.record({
    light: unit, road: unit, act_day: unit, act_night: unit, help: unit, transit: unit, built: unit,
    iso_day: unit, iso_night: unit,
  });
  const keys = ["light", "road", "act_day", "act_night", "help", "transit", "built"] as const;
  const bands = ["day", "evening", "night"] as const;
  const mk = (f: object): CellFeatures => ({ ...base, ...f });

  it("raising any positive feature never lowers the raw score", () => {
    fc.assert(fc.property(feat, fc.constantFrom(...keys), unit, fc.constantFrom(...bands), (f, k, d, b) => {
      const up = { ...f, [k]: Math.min(1, f[k] + d) };
      return rawScore(mk(up), b) >= rawScore(mk(f), b) - 1e-12;
    }), { numRuns: 200 });
  });
  it("raising isolation never raises the raw score", () => {
    fc.assert(fc.property(feat, unit, fc.constantFrom(...bands), (f, d, b) => {
      const up = { ...f, iso_day: Math.min(1, f.iso_day + d), iso_night: Math.min(1, f.iso_night + d) };
      return rawScore(mk(up), b) <= rawScore(mk(f), b) + 1e-12;
    }), { numRuns: 200 });
  });
});

describe("scoreCity", () => {
  it("smooths towards neighbours and keeps scores in 0..100", () => {
    const cells = ["89608b444c3ffff", "89608b444c7ffff", "89608b444cbffff"].map((h3, i) => ({ ...base, h3, light: i / 2, act_night: i / 2 }));
    const { cells: out } = scoreCity(cells);
    for (const v of out.values()) for (const b of ["day", "evening", "night"] as const) {
      expect(v[b].score).toBeGreaterThanOrEqual(0); expect(v[b].score).toBeLessThanOrEqual(100);
    }
  });
});

describe("fixed (national) calibration", () => {
  const cells = ["89608b444c3ffff", "89608b444c7ffff", "89608b444cbffff"].map((h3, i) => ({ ...base, h3, light: i / 2, act_night: i / 2, help: i / 2 }));
  const fixed = { day: { a: 100, b: 0, p5: 0, p95: 1 }, evening: { a: 100, b: 0, p5: 0, p95: 1 }, night: { a: 100, b: 0, p5: 0, p95: 1 } };
  it("uses the supplied calibration instead of the city's own, so tiles stay comparable", () => {
    const own = scoreCity(cells);
    const withFixed = scoreCity(cells, fixed);
    expect(withFixed.calibration.night).toEqual(fixed.night);
    expect(own.calibration.night.a).not.toBe(100);
  });
  it("scores a cell identically whatever else is in its tile (cells far apart don't smooth into each other)", () => {
    const a = { ...base, h3: "89608b444c3ffff", light: 0.9, act_night: 0.8, help: 0.7 };
    const farAway = { ...base, h3: "8960145b493ffff", light: 0.1, act_night: 0, help: 0 };       // a different part of the world
    const solo = scoreCity([a], fixed).cells.get(a.h3)!.night.score;
    const crowd = scoreCity([a, farAway], fixed).cells.get(a.h3)!.night.score;
    expect(crowd).toBe(solo);                                                                    // with city-relative calibration this would shift
    const relSolo = scoreCity([a]).cells.get(a.h3)!.night.score, relCrowd = scoreCity([a, farAway]).cells.get(a.h3)!.night.score;
    expect(relCrowd).not.toBe(relSolo);                                                          // …and it does: that's why a fixed scale is needed
  });
});
