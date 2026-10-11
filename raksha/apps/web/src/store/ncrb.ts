import { create } from "zustand";

export interface NcrbDistrict { key: string; state: string; district: string; totals: (number | null)[]; latest: Record<string, number>; rank?: Record<string, [number, number]> }
export interface NcrbData {
  years: number[]; districts: NcrbDistrict[];
  cities: Record<string, { districts: string[]; totals: (number | null)[] }>;
  states: Record<string, { totals: (number | null)[]; districts: number; rank?: Record<string, [number, number]> }>;
  source: { name: string; url: string }; notes: string;
}

interface State { data: NcrbData | null; status: "idle" | "loading" | "error"; load: () => Promise<void> }

/** District context from NCRB (registered cases). Loaded on demand — it is never part of the street-level score. */
export const useNcrb = create<State>((set, get) => ({
  data: null, status: "idle",
  async load() {
    if (get().data || get().status === "loading") return;
    set({ status: "loading" });
    try {
      const r = await fetch("/data/ncrb/districts.json");
      if (!r.ok) throw new Error(String(r.status));
      set({ data: (await r.json()) as NcrbData, status: "idle" });
    } catch { set({ status: "error" }); }
  },
}));

/** Latest year with a total, and the change vs three years before it. */
export function summarize(totals: (number | null)[], years: number[]) {
  let i = totals.length - 1;
  while (i >= 0 && totals[i] == null) i--;
  if (i < 0) return null;
  const base = totals[Math.max(0, i - 3)];
  const total = totals[i]!;
  return { year: years[i]!, total, baseYear: years[Math.max(0, i - 3)]!, pct: base ? Math.round(((total - base) / base) * 100) : null };
}
