// Vite bundles the MapLibre worker (with its shared chunk) into /assets; without this the production build asks for a file that doesn't exist.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type * as MapLibre from "maplibre-gl";

let done = false;
export function configureMapWorker(ml: typeof MapLibre) {
  if (done) return;
  ml.setWorkerUrl(workerUrl);
  done = true;
}
