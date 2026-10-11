import { create } from "zustand";
import { get as idbGet, set as idbSet } from "idb-keyval";
import {
  adjustmentField, getH3, h3Ready, initH3, makeLookup, parseCellsFile,
  type Adjustments, type CellLookup, type CellMap, type CellsFile,
} from "@raksha/core";
import { getBackend } from "../services/backend";

export interface SafeSpot { kind: "police" | "hospital" | "fuel" | "station"; name: string; lat: number; lng: number; h3: string; "24x7"?: boolean }
export interface CityEntry { id: string; name: string; bbox: [number, number, number, number]; cells: number; version: string }
export interface RegionEntry { id: string; name: string; bbox: [number, number, number, number]; ncrbState?: string; cells: number; tiles: string[]; version: string }
/** What covers a point: a city pack (finest detail, has its own NCRB district) or a state-wide tile. */
export interface Coverage { kind: "city" | "region"; id: string; name: string; ncrbState?: string }
export interface CityMeta { city: string; name: string; bbox: [number, number, number, number]; res: number; attribution: string }

interface CityState {
  status: "idle" | "loading" | "ready" | "error";
  index: CityEntry[];                 // catalogue of city packs (public/data/index.json)
  regions: RegionEntry[];             // state-wide tile catalogue (public/data/regions.json)
  tileRes: number;
  loaded: Record<string, CityMeta>;   // packs merged into `cells`
  res: number;
  cells: CellMap;                     // union of loaded packs (H3 ids are global, so merging is a plain Map union)
  spots: SafeSpot[];
  version: number;                    // bumps whenever the set of loaded cells changes (map redraw trigger)
  adj?: Adjustments;
  lookup: CellLookup;
  init: () => Promise<void>;
  /** Loads the packs covering these points. Returns true if every point has data. */
  ensureFor: (pts: { lat: number; lng: number }[], opts?: { ring?: boolean }) => Promise<boolean>;
  coverageAt: (lat: number, lng: number) => Coverage | undefined;
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
  status: "idle", index: [], regions: [], tileRes: 5, loaded: {}, res: 9, cells: new Map(), spots: [], version: 0, lookup: noLookup,

  async init() {
    if (getState().status !== "idle") return;
    set({ status: "loading" });
    try {
      const [, idx, reg] = await Promise.all([
        initH3(), fetchJson<{ cities: CityEntry[] }>("/data/index.json"),
        fetchJson<{ tileRes: number; regions: RegionEntry[] }>("/data/regions.json").catch(() => ({ tileRes: 5, regions: [] as RegionEntry[] })),
      ]);
      set({ status: "ready", index: idx.cities, regions: reg.regions, tileRes: reg.tileRes });
      // reopen the pack she used last time straight away (works offline too)
      const last = localStorage.getItem(LAST_CITY);
      if (last && idx.cities.some((c) => c.id === last)) await loadPack(last);
    } catch { set({ status: "error" }); }
  },

  coverageAt(lat, lng) {
    const s = getState();
    const city = s.index.find((c) => inBox(c.bbox, lat, lng));
    if (city) return { kind: "city", id: city.id, name: city.name };
    if (!s.regions.length || !h3Ready()) return undefined;
    const tile = getH3().latLngToCell(lat, lng, s.tileRes);
    const reg = s.regions.find((r) => r.tiles.includes(tile));
    return reg ? { kind: "region", id: reg.id, name: reg.name, ncrbState: reg.ncrbState } : undefined;
  },

  /** Loads what covers these points: the city pack, or the state tile (+ its neighbours, so the map around her is filled). */
  async ensureFor(pts, opts) {
    if (getState().status === "idle") await getState().init();
    let all = true;
    const wanted = new Set<string>();
    for (const p of pts) {
      const s = getState(), c = s.coverageAt(p.lat, p.lng);
      if (!c) { all = false; continue; }
      if (c.kind === "city") { wanted.add(`c:${c.id}`); continue; }
      const tile = getH3().latLngToCell(p.lat, p.lng, s.tileRes);
      for (const t of opts?.ring === false ? [tile] : getH3().gridDisk(tile, 1)) wanted.add(`t:${c.id}:${t}`);
    }
    await Promise.all([...wanted].map((w) => (w.startsWith("c:") ? loadPack(w.slice(2)) : loadTile(w.split(":")[1]!, w.split(":")[2]!))));
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

// ---- state tiles ----
const tilesLoaded = new Set<string>();
const tilesLoading = new Map<string, Promise<void>>();
function loadTile(region: string, tile: string): Promise<void> {
  const key = `${region}/${tile}`;
  const reg = useCity.getState().regions.find((r) => r.id === region);
  if (tilesLoaded.has(key) || !reg?.tiles.includes(tile)) return Promise.resolve();      // already here, or no data for that tile
  let p = tilesLoading.get(key);
  if (!p) {
    p = (async () => {
      const f = await fetchJson<CellsFile & { spots: SafeSpot[] }>(`/data/regions/${region}/${tile}.json`);
      const parsed = parseCellsFile({ ...f, city: region });
      const s = useCity.getState();
      const cells = new Map(s.cells);
      for (const [k, v] of parsed.cells) cells.set(k, v);
      tilesLoaded.add(key);
      set_(s, { res: parsed.res, cells, spots: [...s.spots, ...(f.spots ?? [])], lookup: makeLookup(cells, parsed.res, s.adj), version: s.version + 1 });
    })().catch(() => undefined).finally(() => tilesLoading.delete(key));
    tilesLoading.set(key, p);
  }
  return p;
}

/** Polygon outlines for the hex overlay; cached per cell. */
const boundaryCache = new Map<string, number[][]>();
export function hexBoundary(h3: string): number[][] {
  let b = boundaryCache.get(h3);
  if (!b) { b = getH3().cellToBoundary(h3, true) as number[][]; b = [...b, b[0]!]; boundaryCache.set(h3, b); }
  return b;
}
