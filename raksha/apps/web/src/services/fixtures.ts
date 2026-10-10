import { haversine, type LngLat, type Mode, type RouteInput } from "@raksha/core";

export interface Step { startM: number; distanceM: number; name: string; type: string; modifier?: string }
export type RouteWithSteps = RouteInput & { steps?: Step[] };

export interface DemoPreset {
  id: string; title: string; mode: "walk";
  from: { lng: number; lat: number; name: string }; to: { lng: number; lat: number; name: string };
  routes: { duration: number; distance: number; coords: LngLat[] }[];
}
let fixtures: DemoPreset[] = [];
export function setFixtures(f: DemoPreset[]) { fixtures = f; }
export const getFixtures = () => fixtures;

export function fixtureFor(from: LngLat, to: LngLat, mode: Mode): RouteInput[] | null {
  if (mode !== "walk") return null;
  const f = fixtures.find((p) => haversine([p.from.lng, p.from.lat], from) < 60 && haversine([p.to.lng, p.to.lat], to) < 60);
  return f ? f.routes.map((r, i) => ({ id: `r${i}`, coords: r.coords, durationS: r.duration, distanceM: r.distance })) : null;
}

