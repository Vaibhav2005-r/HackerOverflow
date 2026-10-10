import type * as H3Module from "h3-js";

/**
 * h3-js is ~70 KB gzip, and nothing needs it before the city data is loaded. It is therefore imported dynamically:
 * the web app calls `initH3()` right after first paint (in parallel with the city files); Node scripts and tests await it up front.
 */
type Impl = Pick<typeof H3Module, "latLngToCell" | "gridDisk" | "gridRing" | "cellToLatLng" | "cellToBoundary">;
let impl: Impl | undefined;
let loading: Promise<void> | undefined;

export function initH3(): Promise<void> {
  return (loading ??= import("h3-js").then((m) => { impl = m; }));
}
export const h3Ready = () => impl !== undefined;
export function getH3(): Impl {
  if (!impl) throw new Error("h3 is not loaded yet: await initH3() first");
  return impl;
}
