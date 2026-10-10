import { useSettings } from "../store/settings";

export function vibrate(pattern: number[]) {
  if (!useSettings.getState().haptics) return;
  try { navigator.vibrate?.(pattern); } catch { /* unsupported (iOS) */ }
}
