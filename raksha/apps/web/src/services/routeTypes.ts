import type { RouteInput } from "@raksha/core";

/** One turn instruction from the routing engine (OSRM steps). */
export interface Step { startM: number; distanceM: number; name: string; type: string; modifier?: string }
export type RouteWithSteps = RouteInput & { steps?: Step[] };
