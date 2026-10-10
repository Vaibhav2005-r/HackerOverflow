export type LngLat = [number, number];

const R = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversine(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]), dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function cumulative(coords: LngLat[]): number[] {
  const out = [0];
  for (let i = 1; i < coords.length; i++) out.push(out[i - 1]! + haversine(coords[i - 1]!, coords[i]!));
  return out;
}

export function lineLength(coords: LngLat[]): number {
  return cumulative(coords).at(-1) ?? 0;
}

/** Point at `d` metres along the line (clamped to the ends). */
export function pointAt(coords: LngLat[], cum: number[], d: number): LngLat {
  if (coords.length === 0) throw new Error("empty line");
  if (d <= 0) return coords[0]!;
  const total = cum.at(-1)!;
  if (d >= total) return coords.at(-1)!;
  let i = 1;
  while (cum[i]! < d) i++;
  const seg = cum[i]! - cum[i - 1]!;
  const f = seg === 0 ? 0 : (d - cum[i - 1]!) / seg;
  const a = coords[i - 1]!, b = coords[i]!;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

/** Sub-polyline between two distances along the line. */
export function sliceLine(coords: LngLat[], cum: number[], from: number, to: number): LngLat[] {
  const out: LngLat[] = [pointAt(coords, cum, from)];
  for (let i = 0; i < coords.length; i++) if (cum[i]! > from && cum[i]! < to) out.push(coords[i]!);
  out.push(pointAt(coords, cum, to));
  return out;
}

export interface Sample { pt: LngLat; distM: number; startM: number; endM: number; lenM: number }

/** Even samples ≈ every `stepM`, each at the middle of the stretch it represents. */
export function resample(coords: LngLat[], stepM: number): Sample[] {
  const cum = cumulative(coords);
  const total = cum.at(-1) ?? 0;
  if (coords.length === 0) return [];
  if (total === 0) return [{ pt: coords[0]!, distM: 0, startM: 0, endM: 0, lenM: 0 }];
  const n = Math.max(1, Math.round(total / stepM));
  const len = total / n;
  return Array.from({ length: n }, (_, i) => ({
    pt: pointAt(coords, cum, (i + 0.5) * len), distM: (i + 0.5) * len, startM: i * len, endM: (i + 1) * len, lenM: len,
  }));
}

export interface Snap { distAlongM: number; offsetM: number; point: LngLat }

/** Nearest point on the polyline (local equirectangular projection). */
export function snapToLine(coords: LngLat[], p: LngLat, cum = cumulative(coords)): Snap {
  if (coords.length === 0) throw new Error("empty line");
  const kx = 111_320 * Math.cos(rad(p[1])), ky = 110_574;
  let best: Snap = { distAlongM: 0, offsetM: Infinity, point: coords[0]! };
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1]!, b = coords[i]!;
    const ax = (a[0] - p[0]) * kx, ay = (a[1] - p[1]) * ky;
    const bx = (b[0] - p[0]) * kx, by = (b[1] - p[1]) * ky;
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2));
    const px = ax + dx * t, py = ay + dy * t;
    const off = Math.hypot(px, py);
    if (off < best.offsetM) {
      best = { distAlongM: cum[i - 1]! + (cum[i]! - cum[i - 1]!) * t, offsetM: off,
               point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] };
    }
  }
  if (coords.length === 1) best = { distAlongM: 0, offsetM: haversine(coords[0]!, p), point: coords[0]! };
  return best;
}
