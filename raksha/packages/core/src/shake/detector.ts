export const SHAKE_CONFIG = {
  gravity: 9.81,
  peakThreshold: 18,     // m/s² above gravity
  minPeakGapMs: 150,
  peaksRequired: 4,
  windowMs: 2500,
  refractoryMs: 5000,
} as const;

export interface AccelSample { t: number; ax: number; ay: number; az: number }

/** Feed accelerationIncludingGravity samples; returns true when a deliberate shake is detected. */
export class ShakeDetector {
  private peaks: number[] = [];
  private lastPeak = -Infinity;
  private blockedUntil = -Infinity;

  constructor(private cfg: typeof SHAKE_CONFIG = SHAKE_CONFIG) {}

  push(s: AccelSample): boolean {
    if (s.t < this.blockedUntil) return false;
    const mag = Math.hypot(s.ax, s.ay, s.az) - this.cfg.gravity;
    if (mag > this.cfg.peakThreshold && s.t - this.lastPeak >= this.cfg.minPeakGapMs) {
      this.lastPeak = s.t;
      this.peaks.push(s.t);
    }
    this.peaks = this.peaks.filter((p) => s.t - p <= this.cfg.windowMs);
    if (this.peaks.length >= this.cfg.peaksRequired) {
      this.peaks = [];
      this.blockedUntil = s.t + this.cfg.refractoryMs;
      return true;
    }
    return false;
  }

  reset() { this.peaks = []; this.lastPeak = -Infinity; this.blockedUntil = -Infinity; }
}
