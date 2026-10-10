/** Per-key minimum interval (in-memory, per function instance — enough to blunt token polling). */
export class RateLimiter {
  private last = new Map<string, number>();
  constructor(private minIntervalMs: number, private maxKeys = 5000) {}

  /** Returns 0 if the call is allowed, otherwise the milliseconds to wait. */
  check(key: string, now = Date.now()): number {
    const prev = this.last.get(key);
    if (prev !== undefined && now - prev < this.minIntervalMs) return this.minIntervalMs - (now - prev);
    if (this.last.size >= this.maxKeys) this.last.clear();
    this.last.set(key, now);
    return 0;
  }
}
