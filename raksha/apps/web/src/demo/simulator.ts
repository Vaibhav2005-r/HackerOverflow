import { cumulative, pointAt, type LngLat } from "@raksha/core";
import { clock } from "../lib/clock";

export interface SimFix { lat: number; lng: number; accuracy: number; speed: number; heading: number; t: number }

const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());

export interface SimHandle { stop: () => void; setStopped: (b: boolean) => void; readonly stopped: boolean; readonly along: number }

/**
 * Walks `coords` at a realistic pace with GPS jitter (σ ≈ 6 m) and the occasional poor-accuracy fix.
 * Uses the virtual clock, so 5×/15× also speeds up the engine's own timers.
 */
export function startSimulation(coords: LngLat[], metersPerSecond: number, onFix: (f: SimFix) => void, onDone: () => void): SimHandle {
  const cum = cumulative(coords);
  const total = cum.at(-1) ?? 0;
  let along = 0, stopped = false, last = clock.now();
  const tick = () => {
    const t = clock.now();
    if (!stopped) along = Math.min(total, along + metersPerSecond * ((t - last) / 1000));
    last = t;
    const p = pointAt(coords, cum, along), q = pointAt(coords, cum, Math.min(total, along + 8));
    const poor = Math.random() < 0.06;
    const sigma = poor ? 30 : 6;
    const kx = 111_320 * Math.cos((p[1] * Math.PI) / 180);
    const lng = p[0] + (gauss() * sigma) / kx, lat = p[1] + (gauss() * sigma) / 110_574;
    const heading = (Math.atan2((q[0] - p[0]) * kx, (q[1] - p[1]) * 110_574) * 180) / Math.PI;
    onFix({ lat, lng, accuracy: poor ? 70 + Math.random() * 40 : 5 + Math.random() * 8, speed: stopped ? 0 : metersPerSecond, heading: (heading + 360) % 360, t });
    if (along >= total - 12) { stop(); onDone(); }
  };
  const id = setInterval(tick, 1000);
  const stop = () => clearInterval(id);
  tick();
  return { stop, setStopped: (b) => { stopped = b; }, get stopped() { return stopped; }, get along() { return along; } };
}
