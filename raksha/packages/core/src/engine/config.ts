export const ENGINE_CONFIG = {
  maxAccuracyM: 60,              // fixes worse than this never drive guard / heads-up decisions
  emaAlpha: 0.5,                 // display smoothing
  headsUpM: { walk: 150, vehicle: 400 },
  headsUpExpireMs: 15_000,
  guard: {
    minFixGapMs: 5_000, enterFixes: 2, singleFixHoldMs: 10_000,
    isolatedNightMs: 20_000, exitComfortableMs: 60_000,
    manualExitSuppressMs: 120_000, // after "End guard", don't bounce straight back into Guard
  },
  offRoute: { distM: 150, forMs: 60_000 },
  stop: { speedMps: 0.3, forMs: 180_000, minFromDestM: 100 },
  checkIn: { responseMs: 60_000, timerResponseMs: 30_000 },
  timer: { etaFactor: 1.25, graceMs: 180_000, extendMs: 600_000 },
  detour: { maxExtraS: 300, clearanceM: 120 },
  countdownMs: 3_000,
  pin: { wrongLimit: 3, lockoutMs: 30_000 },
  haptics: {
    headsUp: [60, 80, 60], guardOn: [120, 60, 120], tick: [40], sosStart: [400, 150, 400],
    holdTick: [15], checkIn: [200, 100, 200, 100, 200],
  },
} as const;
