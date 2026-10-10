import { z } from "zod";
import type { LngLat, Mode, RouteInput } from "@raksha/core";
import { fixtureFor, type RouteWithSteps, type Step } from "./fixtures";

const OSRM = { walk: "https://routing.openstreetmap.de/routed-foot", vehicle: "https://routing.openstreetmap.de/routed-car" } as const;
const ORS_PROFILE = { walk: "foot-walking", vehicle: "driving-car" } as const;

const osrmSchema = z.object({
  code: z.string(),
  routes: z.array(z.object({
    duration: z.number(), distance: z.number(),
    legs: z.array(z.object({ steps: z.array(z.object({ distance: z.number(), name: z.string().optional(), maneuver: z.object({ type: z.string(), modifier: z.string().optional() }) })).default([]) })).optional(),
    geometry: z.object({ coordinates: z.array(z.tuple([z.number(), z.number()]).rest(z.number())) }),
  })).default([]),
});

const cache = new Map<string, { at: number; routes: RouteWithSteps[] }>();
const TTL_MS = 10 * 60_000;

async function viaOsrm(from: LngLat, to: LngLat, mode: Mode, signal?: AbortSignal): Promise<RouteWithSteps[]> {
  const url = `${OSRM[mode]}/route/v1/driving/${from.join(",")};${to.join(",")}?alternatives=3&overview=full&geometries=geojson&steps=true`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`routing ${res.status}`);
  const j = osrmSchema.parse(await res.json());
  if (j.code !== "Ok") return [];
  return j.routes.map((r, i): RouteWithSteps => {
    let acc = 0;
    const steps = (r.legs ?? []).flatMap((l) => l.steps).map((st): Step => { const s0 = acc; acc += st.distance; return { startM: s0, distanceM: st.distance, name: st.name ?? "", type: st.maneuver.type, modifier: st.maneuver.modifier }; });
    return { id: `r${i}`, coords: r.geometry.coordinates.map((c) => [c[0]!, c[1]!] as LngLat), durationS: r.duration, distanceM: r.distance, steps };
  });
}

async function viaOrs(from: LngLat, to: LngLat, mode: Mode, key: string, signal?: AbortSignal): Promise<RouteInput[]> {
  const res = await fetch(`https://api.openrouteservice.org/v2/directions/${ORS_PROFILE[mode]}/geojson`, {
    method: "POST", signal, headers: { Authorization: key, "Content-Type": "application/json" },
    body: JSON.stringify({ coordinates: [from, to], alternative_routes: { target_count: 3, share_factor: 0.6, weight_factor: 1.6 } }),
  });
  if (!res.ok) throw new Error(`ors ${res.status}`);
  const j = (await res.json()) as { features: { geometry: { coordinates: LngLat[] }; properties: { summary: { duration: number; distance: number } } }[] };
  return j.features.map((f, i) => ({ id: `r${i}`, coords: f.geometry.coordinates.map((c) => [c[0], c[1]] as LngLat), durationS: f.properties.summary.duration, distanceM: f.properties.summary.distance }));
}

/** 2–3 route alternatives. Cached 10 min; falls back to ORS (if keyed) and then to bundled demo fixtures. */
export async function fetchRoutes(from: LngLat, to: LngLat, mode: Mode, signal?: AbortSignal): Promise<RouteWithSteps[]> {
  const key = `${from.map((x) => x.toFixed(3)).join(",")}|${to.map((x) => x.toFixed(4)).join(",")}|${mode}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.routes;
  const fx = fixtureFor(from, to, mode);
  let routes: RouteWithSteps[] | null = null;
  try { routes = await viaOsrm(from, to, mode, signal); } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    const orsKey = import.meta.env.VITE_ORS_KEY as string | undefined;
    if (orsKey) { try { routes = await viaOrs(from, to, mode, orsKey, signal); } catch { /* fall through */ } }
  }
  if (!routes?.length && fx) routes = fx;
  if (!routes) throw new Error("routing unavailable");
  cache.set(key, { at: Date.now(), routes });
  return routes;
}
