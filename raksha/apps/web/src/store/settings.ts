import { create } from "zustand";
import { persist } from "zustand/middleware";
import { setDisplayBand } from "../lib/clock";
import type { Band, PinHash, SosMode } from "@raksha/core";

export interface SettingsState {
  name: string;
  lang: "en" | "hi";
  voice: boolean;
  haptics: boolean;
  sosMode: SosMode;
  hand: "left" | "right";
  onboarded: boolean;
  pin?: PinHash;
  duress?: PinHash;
  shakeAlwaysArmed: boolean;
  demoBand: "auto" | Band;      // "Pretend it's" — judges evaluate in daylight, so default to night
  simSpeed: 1 | 5 | 15;
  showHex: boolean;
  reduceMotion: boolean;
  shareWalk: boolean;
  checkLate: boolean;
  recents: { name: string; detail?: string; lng: number; lat: number }[];
  set: (p: Partial<Omit<SettingsState, "set" | "reset">>) => void;
  reset: () => void;
}

const defaults = {
  name: "", lang: "en" as const, voice: false, haptics: true, sosMode: "silent" as SosMode, hand: "right" as const,
  onboarded: false, pin: undefined, duress: undefined, shakeAlwaysArmed: false, demoBand: "night" as const,
  simSpeed: 5 as const, showHex: true, reduceMotion: false, shareWalk: false, checkLate: true, recents: [] as SettingsState["recents"],
};

export const useSettings = create<SettingsState>()(persist((set) => ({
  ...defaults,
  set: (p) => set(p),
  reset: () => set({ ...defaults }),
}), { name: "raksha:settings" }));

export const MIN_CITY = "mumbai_demo";

// the display clock follows the "Pretend it's" setting
setDisplayBand(useSettings.getState().demoBand);
useSettings.subscribe((s) => setDisplayBand(s.demoBand));
