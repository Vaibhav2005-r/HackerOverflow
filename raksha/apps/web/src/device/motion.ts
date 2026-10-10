import { ShakeDetector } from "@raksha/core";

type DME = typeof DeviceMotionEvent & { requestPermission?: () => Promise<"granted" | "denied"> };

/** iOS requires a user gesture; elsewhere this resolves true if the API exists. */
export async function requestMotionPermission(): Promise<boolean> {
  if (typeof DeviceMotionEvent === "undefined") return false;
  const dme = DeviceMotionEvent as DME;
  if (typeof dme.requestPermission === "function") {
    try { return (await dme.requestPermission()) === "granted"; } catch { return false; }
  }
  return true;
}

let handler: ((e: DeviceMotionEvent) => void) | null = null;
const detector = new ShakeDetector();

export function startShakeListening(onShake: () => void) {
  stopShakeListening();
  handler = (e) => {
    const a = e.accelerationIncludingGravity;
    if (a && detector.push({ t: Date.now(), ax: a.x ?? 0, ay: a.y ?? 0, az: a.z ?? 0 })) onShake();
  };
  window.addEventListener("devicemotion", handler);
}
export function stopShakeListening() {
  if (handler) window.removeEventListener("devicemotion", handler);
  handler = null; detector.reset();
}
