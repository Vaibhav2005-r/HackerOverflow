import { describe, expect, it } from "vitest";
import { cumulative, haversine, lineLength, pointAt, resample, sliceLine, snapToLine, type LngLat } from "./geo";
import { LAT0, line, lngAt } from "../testing";

describe("geo", () => {
  it("haversine ≈ known distance (1° lat ≈ 111.2 km)", () => {
    expect(haversine([72, 19], [72, 20])).toBeCloseTo(111_195, -2);
    expect(haversine([72, 19], [72, 19])).toBe(0);
  });
  it("resample keeps spacing within ±2% and covers the whole line", () => {
    const r = line(0, 1000);
    for (const step of [25, 50]) {
      const s = resample(r, step);
      expect(s.reduce((a, x) => a + x.lenM, 0)).toBeCloseTo(lineLength(r), 3);
      for (let i = 1; i < s.length; i++) expect(Math.abs(haversine(s[i - 1]!.pt, s[i]!.pt) / step - 1)).toBeLessThan(0.02);
    }
  });
  it("resample handles degenerate lines", () => {
    expect(resample([], 25)).toEqual([]);
    expect(resample([[72, 19]], 25)).toHaveLength(1);
    expect(resample([[72, 19], [72, 19]], 25)[0]!.lenM).toBe(0);
  });
  it("pointAt clamps and interpolates", () => {
    const c = line(0, 100, 1); const cum = cumulative(c);
    expect(pointAt(c, cum, -5)).toEqual(c[0]);
    expect(pointAt(c, cum, 500)).toEqual(c[1]);
    expect(pointAt(c, cum, cum[1]! / 2)[0]).toBeCloseTo(lngAt(50), 8);
    expect(() => pointAt([], [0], 1)).toThrow();
  });
  it("sliceLine returns the sub-polyline", () => {
    const c = line(0, 1000, 10); const cum = cumulative(c);
    const s = sliceLine(c, cum, 150, 450);
    expect(lineLength(s)).toBeCloseTo(300, 0);
  });
  it("snapToLine finds distance along and offset", () => {
    const c = line(0, 1000);
    const sn = snapToLine(c, [lngAt(400), LAT0 + 0.001]);
    expect(sn.distAlongM).toBeCloseTo(400, 0);
    expect(sn.offsetM).toBeCloseTo(110.6, 0);
    expect(snapToLine(c, [lngAt(-500), LAT0]).distAlongM).toBe(0);
    const single: LngLat[] = [[72, 19]];
    expect(snapToLine(single, [72.001, 19]).offsetM).toBeGreaterThan(100);
    expect(() => snapToLine([], [0, 0])).toThrow();
    expect(snapToLine([[72, 19], [72, 19]], [72, 19.001]).distAlongM).toBe(0);
  });
});
