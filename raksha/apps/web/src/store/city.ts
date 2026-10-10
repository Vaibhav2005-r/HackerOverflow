import { create } from "zustand";
import { get as idbGet, set as idbSet } from "idb-keyval";
import {
  adjustmentField, getH3, initH3, makeLookup, parseCellsFile, type Adjustments, type CellLookup, type CellMap, type CellsFile,
} from "@raksha/core";
import { setFixtures, type DemoPreset } from "../services/fixtures";
import { getBackend } from "../services/backend";

export interface SafeSpot { kind: "police" | "hospital" | "fuel" | "station"; name: string; lat: number; lng: number; h3: string; "24x7"?: boolean }
export interface CityMeta { city: string; name: string; bbox: [number, number, number, number]; res: number; attribution: string }

interface CityState {
  status: "idle" | "loading" | "ready" | "error";
  meta?: CityMeta;
  res: number;
  cells: CellMap;
  spots: SafeSpot[];
  adj?: Adjustments;
  lookup: CellLookup;
  load: (city: string) => Promise<void>;
  refreshAggregates: () => Promise<void>;
}

const noLookup: CellLookup = () => undefined;
const CITY = (import.meta.env.VITE_DEFAULT_CITY as string | undefined) ?? "mumbai_demo";

async function fetchJson<T>(url: string): Promise<T> {
  const key = `raksha:data:${url}`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(String(r.status));
    const j = (await r.json()) as T;
    void idbSet(key, j);
    return j;
  } catch (e) {
    const cached = await idbGet<T>(key); // offline: use the last good copy
    if (cached) return cached;
    throw e;
  }
}

export const useCity = create<CityState>((set, getState) => ({
  status: "idle", res: 9, cells: new Map(), spots: [], lookup: noLookup,
  async load(city = CITY) {
    if (getState().status === "loading") return;
    set({ status: "loading" });
    try {
      const base = `/data/${city}`;
      const [, meta, cellsFile, spots, demo] = await Promise.all([
        initH3(),
        fetchJson<CityMeta>(`${base}/meta.json`), fetchJson<CellsFile>(`${base}/cells.json`),
        fetchJson<{ spots: SafeSpot[] }>(`${base}/safe_spots.json`),
        fetchJson<{ presets: DemoPreset[] }>(`${base}/demo_routes.json`).catch(() => ({ presets: [] as DemoPreset[] })),
      ]);
      setFixtures(demo.presets);
      const { res, cells } = parseCellsFile(cellsFile);
      const adj = getState().adj;
      set({ status: "ready", meta, res, cells, spots: spots.spots, lookup: makeLookup(cells, res, adj) });
      void getState().refreshAggregates();
    } catch { set({ status: "error" }); }
  },
  /** Pulls decayed community weights for every cell from the backend (Supabase RPC, or local seeds + local reports). */
  async refreshAggregates() {
    const { cells, res } = getState();
    if (cells.size === 0) return;
    try {
      const aggs = await getBackend().getAggregates([...cells.keys()]);
      const adj = adjustmentField(aggs);
      set({ adj, lookup: makeLookup(cells, res, adj) });
    } catch { /* offline or backend down: scores simply stay unadjusted */ }
  },
}));

export const DEFAULT_CITY = CITY;

/** Polygon outlines for the hex overlay; cached per cell. */
const boundaryCache = new Map<string, number[][]>();
export function hexBoundary(h3: string): number[][] {
  let b = boundaryCache.get(h3);
  if (!b) { b = getH3().cellToBoundary(h3, true) as number[][]; b = [...b, b[0]!]; boundaryCache.set(h3, b); }
  return b;
}
