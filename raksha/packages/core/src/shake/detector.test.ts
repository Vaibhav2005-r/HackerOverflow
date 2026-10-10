import { describe, expect, it } from "vitest";
import { ShakeDetector, type AccelSample } from "./detector";

const G = 9.81;
/** 50 Hz trace; `pulseAt` lists times (ms) of single-sample spikes of the given magnitude above gravity. */
function trace(durationMs: number, pulseAt: number[], mag: number, noise = 0): AccelSample[] {
  const out: AccelSample[] = [];
  for (let t = 0; t <= durationMs; t += 20) {
    const spike = pulseAt.some((p) => Math.abs(p - t) < 10);
    out.push({ t, ax: noise * Math.sin(t / 40), ay: noise * Math.cos(t / 55), az: G + (spike ? mag : noise * Math.sin(t / 25)) });
  }
  return out;
}
const run = (s: AccelSample[], det = new ShakeDetector()) => s.filter((x) => det.push(x)).map((x) => x.t);
const every = (period: number, n: number, start = 0) => Array.from({ length: n }, (_, i) => start + i * period);

describe("ShakeDetector", () => {
  it("walking (peaks ≈ 5 m/s²) never triggers", () => {
    expect(run(trace(30_000, every(500, 60), 5, 1))).toEqual([]);
  });
  it("running (peaks ≈ 12 m/s² at ~2.7 Hz) never triggers", () => {
    expect(run(trace(30_000, every(370, 80), 12, 2))).toEqual([]);
  });
  it("a deliberate shake (4 hard peaks in < 2.5 s) triggers on the 4th peak", () => {
    expect(run(trace(3000, every(200, 4, 400), 25))).toEqual([1000]);
  });
  it("3 peaks alone do not trigger", () => {
    expect(run(trace(3000, every(200, 3, 400), 25))).toEqual([]);
  });
  it("peaks spread beyond the 2.5 s window do not trigger", () => {
    expect(run(trace(8000, every(1000, 5, 400), 25))).toEqual([]);
  });
  it("peaks closer than 150 ms count once", () => {
    expect(run(trace(3000, every(100, 6, 400), 25))).toEqual([]);   // 100 ms apart → ~3 counted peaks
    expect(run(trace(3000, every(100, 8, 400), 25)).length).toBe(1); // enough survive the 150 ms gap
  });
  it("honours the 5 s refractory period, then re-arms", () => {
    const det = new ShakeDetector();
    const first = run(trace(1500, every(200, 4, 100), 25), det);
    const during = run(trace(4000, every(200, 8, 1700), 25).filter((x) => x.t < 5000), det);
    expect(first).toHaveLength(1); expect(during).toEqual([]);
    const after = run(trace(12_000, every(200, 4, 7000), 25).filter((x) => x.t >= 7000), det);
    expect(after).toHaveLength(1);
  });
  it("reset() clears state", () => {
    const det = new ShakeDetector();
    run(trace(1500, every(200, 4, 100), 25), det); det.reset();
    expect(run(trace(1500, every(200, 4, 100), 25), det)).toHaveLength(1);
  });
});
