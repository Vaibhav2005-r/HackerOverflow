import { create } from "zustand";
import { get as idbGet, set as idbSet } from "idb-keyval";
import {
  adjustmentField, getH3, initH3, makeLookup, parseCellsFile,
  type Adjustments, type CellLookup, type CellMap, type CellsFile,
} from "@raksha/core";
import { getBackend } from "../services/backend";

export interface SafeSpot { kind: "police" | "hospital" | "fuel" | "station"; name: string; lat: number; lng: number; h3: string; "24x7"?: boolean }
export interface CityEntry { id: string; name: string; bbox: [number, number, number, number]; cells: number; version: string }
export interface CityMeta { city: string; name: string; bbox: [number, number, number, number]; res: number; attribution: string }

interface CityState {
  status: "idle" | "loading" | "ready" | "error";
  index: CityEntry[];                 // catalogue of city packs (public/data/index.json)
  loaded: Record<string, CityMeta>;   // packs merged into `cells`
  res: number;
  cells: CellMap;                     // union of loaded packs (H3 ids are global, so merging is a plain Map union)
  spots: SafeSpot[];
  version: number;                    // bumps whenever the set of loaded cells changes (map redraw trigger)
  adj?: Adjustments;
  lookup: CellLookup;
  init: () => Promise<void>;
  /** Loads the packs covering these points. Returns true if every point has data. */
  ensureFor: (pts: { lat: number; lng: number }[]) => Promise<boolean>;
  coverageAt: (lat: number, lng: number) => CityEntry | undefined;
  refreshAggregates: () => Promise<void>;
}

const noLookup: CellLookup = () => undefined;
const LAST_CITY = "raksha:lastCity";
const inBox = (b: CityEntry["bbox"], lat: number, lng: number) => lat >= b[0] && lat <= b[2] && lng >= b[1] && lng <= b[3];

async function fetchJson<T>(url: string): Promise<T> {
  const key = `raksha:data:${url}`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(String(r.status));
    const j = (await r.json()) as T;
    void idbSet(key, j);
    return j;
  } catch (e) {
    const cached = await idbGet<T>(key); // offline: the last good copy
    if (cached) return cached;
    throw e;
  }
}

const loading = new Map<string, Promise<void>>();

export const useCity = create<CityState>((set, getState) => ({
  status: "idle", index: [], loaded: {}, res: 9, cells: new Map(), spots: [], version: 0, lookup: noLookup,

  async init() {
    if (getState().status !== "idle") return;
    set({ status: "loading" });
    try {
      const [, idx] = await Promise.all([initH3(), fetchJson<{ cities: CityEntry[] }>("/data/index.json")]);
      set({ status: "ready", index: idx.cities });
      // reopen the pack she used last time straight away (works offline too)
      const last = localStorage.getItem(LAST_CITY);
      if (last && idx.cities.some((c) => c.id === last)) await loadPack(last);
    } catch { set({ status: "error" }); }
  },

  coverageAt(lat, lng) { return getState().index.find((c) => inBox(c.bbox, lat, lng)); },

  async ensureFor(pts) {
    if (getState().status === "idle") await getState().init();
    let all = true;
    await Promise.all(pts.map(async (p) => {
      const c = getState().coverageAt(p.lat, p.lng);
      if (!c) { all = false; return; }
      await loadPack(c.id);
    }));
    return all;
  },

  /** Pulls decayed community weights for every loaded cell (Supabase RPC, or this device's own reports in local mode). */
  async refreshAggregates() {
    const { cells, res } = getState();
    if (cells.size === 0) return;
    try {
      const adj = adjustmentField(await getBackend().getAggregates([...cells.keys()]));
      set({ adj, lookup: makeLookup(getState().cells, res, adj), version: getState().version + 1 });
    } catch { /* offline or backend down: scores simply stay unadjusted */ }
  },
}));

function loadPack(id: string): Promise<void> {
  if (useCity.getState().loaded[id]) return Promise.resolve();
  let p = loading.get(id);
  if (!p) {
    p = (async () => {
      const base = `/data/${id}`;
      const [meta, cellsFile, spots] = await Promise.all([
        fetchJson<CityMeta>(`${base}/meta.json`), fetchJson<CellsFile>(`${base}/cells.json`), fetchJson<{ spots: SafeSpot[] }>(`${base}/safe_spots.json`),
      ]);
      const parsed = parseCellsFile(cellsFile);
      const s = useCity.getState();
      const cells = new Map(s.cells);
      for (const [k, v] of parsed.cells) cells.set(k, v);
      set_(s, { loaded: { ...s.loaded, [id]: meta }, res: parsed.res, cells, spots: [...s.spots, ...spots.spots], lookup: makeLookup(cells, parsed.res, s.adj), version: s.version + 1 });
      try { localStorage.setItem(LAST_CITY, id); } catch { /* private mode */ }
      void useCity.getState().refreshAggregates();
    })().finally(() => loading.delete(id));
    loading.set(id, p);
  }
  return p;
}
const set_ = (_s: CityState, patch: Partial<CityState>) => useCity.setState(patch);

/** Polygon outlines for the hex overlay; cached per cell. */
const boundaryCache = new Map<string, number[][]>();
export function hexBoundary(h3: string): number[][] {
  let b = boundaryCache.get(h3);
  if (!b) { b = getH3().cellToBoundary(h3, true) as number[][]; b = [...b, b[0]!]; boundaryCache.set(h3, b); }
  return b;
}
