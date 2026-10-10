import { get, set } from "idb-keyval";
import { getBackend, type LivePoint } from "./backend";

/**
 * Reliability for the moments that matter. Positions and cancel/resolve calls are never just "fire and forget":
 * they queue here and retry (on a timer and when the network returns) until the backend accepts them.
 */
const MAX_POINTS = 150;
const points = new Map<string, LivePoint[]>();
let flushing = false;
const latestFirst = new Set<string>();

/** Queue a position for a share/SOS session and try to send it right away. */
export function sendPoint(sessionId: string, p: LivePoint) {
  const q = points.get(sessionId) ?? [];
  q.push(p);
  if (q.length > MAX_POINTS) q.splice(0, q.length - MAX_POINTS);
  points.set(sessionId, q);
  void flushPoints();
}

export const pendingPoints = () => [...points.values()].reduce((n, q) => n + q.length, 0);
export const forgetSession = (sessionId: string) => { points.delete(sessionId); latestFirst.delete(sessionId); };

/** After an outage the newest position goes first (that's where she is now), then the older trail drains in order.
 *  A point is only removed once the backend has accepted it, so a failure never loses or reorders anything. */
export async function flushPoints() {
  if (flushing) return;
  flushing = true;
  try {
    for (const [sid, q] of points) {
      while (q.length) {
        const newestFirst = !latestFirst.has(sid) && q.length > 1;
        const i = newestFirst ? q.length - 1 : 0;
        try { await getBackend().pushPoint(sid, q[i]!); } catch { return; }        // still offline: retry on the next tick
        q.splice(i, 1);
        if (newestFirst) latestFirst.add(sid);
      }
      points.delete(sid); latestFirst.delete(sid);
    }
  } finally { flushing = false; }
}

// ---- resolve / cancel (persisted: a duress flag must survive a reload) ----
interface PendingResolve { sosId: string; duress: boolean }
const KEY = "raksha:outbox:resolve";

let chain: Promise<unknown> = Promise.resolve();
const serial = <T>(fn: () => Promise<T>): Promise<T> => { const p = chain.then(fn, fn); chain = p.catch(() => undefined); return p; };

export function queueResolve(r: PendingResolve) {
  return serial(async () => {
    const list = ((await get<PendingResolve[]>(KEY)) ?? []).filter((x) => x.sosId !== r.sosId);   // a later cancel replaces an earlier one
    await set(KEY, [...list, r]);
    await drain();
  });
}

async function drain() {
  const list = (await get<PendingResolve[]>(KEY)) ?? [];
  if (!list.length) return;
  const left: PendingResolve[] = [];
  for (const r of list) { try { await getBackend().resolveSos(r.sosId, r.duress); } catch { left.push(r); } }
  await set(KEY, left);
}
export const flushResolves = () => serial(drain);

let started = false;
export function startOutbox() {
  if (started) return;
  started = true;
  const tick = () => { void flushPoints(); void flushResolves(); };
  window.addEventListener("online", tick);
  setInterval(tick, 10_000);
  tick();
}
