import { create } from "zustand";
import type { LngLat, SafetyClass } from "@raksha/core";

export type OrbState = "idle" | "thinking" | "headsUp" | "guard" | "sos" | "arrived";

export interface MapRoute { id: string; segments: { coords: LngLat[]; cls: SafetyClass }[]; selected: boolean }

interface MapUiState {
  routes: MapRoute[];
  user?: { lat: number; lng: number; heading?: number | null; accuracy?: number; state: OrbState };
  follow: boolean;
  showSpots: boolean;
  guard: boolean;
  dest?: { lng: number; lat: number };
  fit?: { bounds: [[number, number], [number, number]]; nonce: number };
  flyTo?: { lng: number; lat: number; zoom: number; nonce: number };
  hexTap?: { h3: string; nonce: number };
  set: (p: Partial<Omit<MapUiState, "set">>) => void;
}

export const useMapUi = create<MapUiState>((set) => ({
  routes: [], follow: false, showSpots: true, guard: false,
  set: (p) => set(p),
}));

let nonce = 0;
export const nextNonce = () => ++nonce;
