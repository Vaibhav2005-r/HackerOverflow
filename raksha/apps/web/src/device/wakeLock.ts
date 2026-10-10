let sentinel: WakeLockSentinel | null = null;
let wanted = false;

async function acquire() {
  if (!wanted || sentinel || !("wakeLock" in navigator)) return;
  try {
    sentinel = await navigator.wakeLock.request("screen");
    sentinel.addEventListener("release", () => { sentinel = null; });
  } catch { /* denied or not visible */ }
}

export function setWakeLock(on: boolean) {
  wanted = on;
  if (on) void acquire(); else { void sentinel?.release(); sentinel = null; }
}

document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void acquire(); });
