/** Virtual clock: demo "simulate walk" runs at 1×/5×/15× so engine timers scale with it. */
let anchorReal = Date.now();
let anchorVirtual = anchorReal;
let speed = 1;

export const clock = {
  now: () => anchorVirtual + (Date.now() - anchorReal) * speed,
  setSpeed(s: number) { anchorVirtual = clock.now(); anchorReal = Date.now(); speed = s; },
  get speed() { return speed; },
};

// ---- display clock: with "Pretend it's …" on, show a time that matches the band (23:04 / 19:30 / 14:00 IST) and keep it ticking ----
const DEMO_MINUTES = { night: 23 * 60 + 4, evening: 19 * 60 + 30, day: 14 * 60 } as const;
const loadedAt = clock.now();
let band: "auto" | "day" | "evening" | "night" = "auto";
export const setDisplayBand = (b: typeof band) => { band = b; };

/** Formats a (virtual) timestamp as "11:04 PM" in IST, shifted into the demo band's time of day when pretending. */
export function fmtClock(virtualMs: number): string {
  let ms = virtualMs;
  if (band !== "auto") {
    const dayStart = Math.floor((Date.now() + 330 * 60_000) / 86_400_000) * 86_400_000 - 330 * 60_000;
    ms = dayStart + DEMO_MINUTES[band] * 60_000 + (virtualMs - loadedAt);
  }
  return new Date(ms).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).toUpperCase();
}
