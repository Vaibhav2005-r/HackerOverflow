import { useEffect, useRef } from "react";
import type { GeoJSONSource, Map as MLMap, Marker, StyleSpecification } from "maplibre-gl";
import { cellInfo, haversine, type Band } from "@raksha/core";
import { useCity, hexBoundary } from "../store/city";
import { useMapUi, nextNonce } from "../store/mapUi";
import { useSettings } from "../store/settings";
import { useBand } from "../lib/useBand";
import { CLASS_COLOR, SPOT_STROKE } from "./colors";
import { fallbackStyle, loadBaseStyle, toNight } from "./style";

const FALLBACK_CENTER: [number, number] = [72.857, 19.19];
const EMPTY = { type: "FeatureCollection", features: [] } as const;

let lastUser: { lat: number; lng: number } | null = null;

/** Hexes fade with distance from the user (1 → .15 over ~2.5 km) so the area around her reads first. */
function hexData(band: Band) {
  const { cells, adj } = useCity.getState();
  const u = lastUser;
  const features = [];
  for (const h3 of cells.keys()) {
    const info = cellInfo(cells, h3, band, adj)!;
    let fade = 1;
    if (u) {
      const [lat, lng] = h3ToLatLng(h3);
      fade = Math.max(0.15, Math.min(1, 1.2 - haversine([u.lng, u.lat], [lng, lat]) / 2500));
    }
    features.push({ type: "Feature" as const, properties: { h3, cls: info.cls, score: info.score, fade }, geometry: { type: "Polygon" as const, coordinates: [hexBoundary(h3)] } });
  }
  return { type: "FeatureCollection" as const, features };
}
function h3ToLatLng(h3: string): [number, number] { const b = hexBoundary(h3); const n = b.length - 1; let la = 0, lo = 0; for (let i = 0; i < n; i++) { lo += b[i]![0]!; la += b[i]![1]!; } return [la / n, lo / n]; }

function routeData() {
  const features = useMapUi.getState().routes.flatMap((r) =>
    r.segments.map((s) => ({ type: "Feature" as const, properties: { id: r.id, cls: s.cls, sel: r.selected ? 1 : 0 }, geometry: { type: "LineString" as const, coordinates: s.coords } })));
  features.sort((a, b) => a.properties.sel - b.properties.sel); // selected on top
  return { type: "FeatureCollection" as const, features };
}
const spotData = () => ({
  type: "FeatureCollection" as const,
  features: useCity.getState().spots.map((s) => ({ type: "Feature" as const, properties: { kind: s.kind, name: s.name }, geometry: { type: "Point" as const, coordinates: [s.lng, s.lat] } })),
});

const classMatch = ["match", ["get", "cls"], "COMFORTABLE", CLASS_COLOR.COMFORTABLE, "STAY_ALERT", CLASS_COLOR.STAY_ALERT, "EXTRA_CARE", CLASS_COLOR.EXTRA_CARE, "#888"] as never;
const fillOpacity = (base: number) => ["*", base, ["get", "fade"]] as never;

// Lucide-style glyphs (24×24, stroke 1.75) for the safe-spot symbols
const GLYPH: Record<string, string> = {
  police: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  hospital: '<path d="M12 7v10M7 12h10"/><rect x="3" y="3" width="18" height="18" rx="3"/>',
  fuel: '<path d="M3 22V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v18M3 22h10M13 10h2a2 2 0 0 1 2 2v3a2 2 0 0 0 4 0V8l-3-3M6 8h4"/>',
  station: '<rect x="5" y="3" width="14" height="15" rx="3"/><path d="M5 11h14M8 21l2-3M16 21l-2-3"/>',
};
function loadIcons(map: MLMap) {
  for (const [kind, body] of Object.entries(GLYPH)) {
    const id = `spot-${kind}`;
    if (map.hasImage(id)) continue;
    const img = new Image(36, 36);
    img.onload = () => { if (!map.hasImage(id)) try { map.addImage(id, img, { pixelRatio: 2 }); } catch { /* style swapped */ } };
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`)}`;
  }
}

function addOverlays(map: MLMap) {
  if (map.getSource("hex")) return;
  for (const id of ["hex", "routes", "spots"]) map.addSource(id, { type: "geojson", data: EMPTY as never });
  const notExtra = ["!=", ["get", "cls"], "EXTRA_CARE"] as never, isExtra = ["==", ["get", "cls"], "EXTRA_CARE"] as never;
  map.addLayer({ id: "hex-fill", type: "fill", source: "hex", minzoom: 12, filter: notExtra, paint: { "fill-color": classMatch, "fill-opacity": fillOpacity(0.22) } });
  map.addLayer({ id: "hex-fill-extra", type: "fill", source: "hex", minzoom: 12, filter: isExtra, paint: { "fill-color": classMatch, "fill-opacity": fillOpacity(0.22) } });
  map.addLayer({ id: "hex-line", type: "line", source: "hex", minzoom: 12, paint: { "line-color": classMatch, "line-opacity": ["*", 0.4, ["get", "fade"]] as never, "line-width": 1 } });
  map.addLayer({ id: "hex-hit", type: "fill", source: "hex", minzoom: 12, paint: { "fill-color": "#000", "fill-opacity": 0 } });
  map.addLayer({ id: "routes-glow", type: "line", source: "routes", filter: ["==", ["get", "sel"], 1], layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": classMatch, "line-width": 16, "line-blur": 12, "line-opacity": 0.35, "line-opacity-transition": { duration: 600, delay: 0 } } });
  map.addLayer({ id: "routes-line", type: "line", source: "routes", layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": classMatch, "line-width": ["case", ["==", ["get", "sel"], 1], 7, 4] as never, "line-opacity": ["case", ["==", ["get", "sel"], 1], 1, 0.45] as never, "line-opacity-transition": { duration: 600, delay: 0 } } });
  map.addLayer({ id: "spots", type: "circle", source: "spots", minzoom: 14.2, paint: { "circle-radius": 12, "circle-color": "#1B1929", "circle-stroke-color": SPOT_STROKE, "circle-stroke-width": 1.5 } });
  map.addLayer({ id: "spot-icons", type: "symbol", source: "spots", minzoom: 14.2, layout: { "icon-image": ["concat", "spot-", ["get", "kind"]] as never, "icon-size": 0.5, "icon-allow-overlap": true } });
  loadIcons(map);
}

function userEl() {
  const el = document.createElement("div");
  el.className = "user-marker"; el.dataset.testid = "user-marker";
  el.innerHTML = '<div class="u-acc"></div><div class="u-cone"></div><div class="u-pulse"></div><div class="u-dot"></div>';
  return el;
}
const destEl = () => { const el = document.createElement("div"); el.className = "dest-marker"; el.dataset.testid = "dest-marker"; return el; };

/** One persistent map for Home / Plan / Journey / Guard. MapLibre loads lazily so the shell paints first. */
export default function MapView({ hidden }: { hidden: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const userMarker = useRef<Marker | null>(null);
  const destMarker = useRef<Marker | null>(null);
  const mlRef = useRef<typeof import("maplibre-gl") | null>(null);
  const styleKey = useRef<string>("");

  const demoBand = useSettings((s) => s.demoBand);
  const showHex = useSettings((s) => s.showHex);
  const reduce = useSettings((s) => s.reduceMotion);
  const band: Band = useBand(demoBand);
  const dark = band !== "day";
  const guard = useMapUi((s) => s.guard);

  const push = () => {
    const map = mapRef.current;
    if (!map) return;
    try { // isStyleLoaded() is false while tiles stream in; adding sources only needs the style itself
      addOverlays(map);
      (map.getSource("hex") as GeoJSONSource).setData(hexData(band) as never);
      (map.getSource("routes") as GeoJSONSource).setData(routeData() as never);
      (map.getSource("spots") as GeoJSONSource).setData(spotData() as never);
      for (const id of ["hex-fill", "hex-fill-extra", "hex-line"]) map.setLayoutProperty(id, "visibility", showHex ? "visible" : "none");
      map.setPaintProperty("spots", "circle-radius", guard ? 15 : 12);
    } catch { /* style not ready yet: the 'style.load' handler pushes again */ }
  };
  const pushRef = useRef(push); pushRef.current = push;

  const applyStyle = () => {
    const map = mapRef.current;
    if (!map) return;
    const key = dark ? "night" : "day";
    if (styleKey.current === key) return;
    styleKey.current = key;
    void loadBaseStyle().then((s) => {
      if (!mapRef.current || styleKey.current !== key) return;
      const style: StyleSpecification = s ? (dark ? toNight(s) : s) : fallbackStyle(dark);
      mapRef.current.setStyle(style, { diff: false });
    });
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [ml] = await Promise.all([import("maplibre-gl"), import("maplibre-gl/dist/maplibre-gl.css")]);
      if (cancelled || !box.current) return;
      mlRef.current = ml;
      const meta = useCity.getState().meta;
      const center: [number, number] = meta ? [(meta.bbox[1] + meta.bbox[3]) / 2, (meta.bbox[0] + meta.bbox[2]) / 2] : FALLBACK_CENTER;
      const map = new ml.Map({ container: box.current, style: fallbackStyle(dark), center, zoom: 13.6, attributionControl: { compact: true }, maxPitch: 60 });
      mapRef.current = map;
      userMarker.current = new ml.Marker({ element: userEl(), pitchAlignment: "map", rotationAlignment: "map" });
      destMarker.current = new ml.Marker({ element: destEl() });
      map.on("style.load", () => pushRef.current());
      map.on("click", "hex-hit", (e) => {
        const h3 = e.features?.[0]?.properties?.h3 as string | undefined;
        if (h3) useMapUi.getState().set({ hexTap: { h3, nonce: nextNonce() } });
      });
      map.on("mouseenter", "hex-hit", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "hex-hit", () => { map.getCanvas().style.cursor = ""; });
      (window as unknown as { __rakshaMap?: MLMap }).__rakshaMap = map; // test/debug hook
      styleKey.current = "";
      applyStyle();
    })();
    return () => { cancelled = true; userMarker.current?.remove(); destMarker.current?.remove(); mapRef.current?.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(applyStyle, [dark]);

  const cellsStatus = useCity((s) => s.status);
  const adj = useCity((s) => s.adj);
  const routes = useMapUi((s) => s.routes);
  useEffect(push, [band, showHex, cellsStatus, adj, routes, guard]);

  // Extra-care hexes: 6 s opacity shimmer between 1 and .45 (off with reduced motion)
  useEffect(() => {
    if (reduce || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const i = setInterval(() => {
      const map = mapRef.current;
      if (!map || !map.getLayer("hex-fill-extra")) return;
      const k = 0.725 + 0.275 * Math.sin((Date.now() / 6000) * 2 * Math.PI);
      map.setPaintProperty("hex-fill-extra", "fill-opacity", ["*", 0.22 * k, ["get", "fade"]]);
    }, 250);
    return () => clearInterval(i);
  }, [reduce]);

  const user = useMapUi((s) => s.user);
  const follow = useMapUi((s) => s.follow);
  useEffect(() => {
    const map = mapRef.current, marker = userMarker.current;
    if (!map || !marker) return;
    if (!user) { marker.remove(); return; }
    marker.setLngLat([user.lng, user.lat]);
    if (!marker.getElement().isConnected) marker.addTo(map);
    const el = marker.getElement();
    el.dataset.state = user.state;
    el.style.setProperty("--heading", `${user.heading ?? 0}deg`);
    el.classList.toggle("has-heading", user.heading != null);
    const acc = Math.min(60, Math.max(30, (user.accuracy ?? 30)));
    (el.querySelector(".u-acc") as HTMLElement).style.transform = `scale(${acc / 30})`;
    if (!lastUser || haversine([lastUser.lng, lastUser.lat], [user.lng, user.lat]) > 120) { lastUser = { lat: user.lat, lng: user.lng }; pushRef.current(); }
    if (follow) {
      // In Guard the top ~310 px is the map: park the user dot there
      const pad = guard ? { top: 0, left: 0, right: 0, bottom: Math.max(0, window.innerHeight - 310) } : { top: 0, left: 0, right: 0, bottom: 0 };
      map.easeTo({ center: [user.lng, user.lat], zoom: guard ? 17.2 : 17, pitch: guard ? 0 : 45, bearing: guard ? 0 : (user.heading ?? map.getBearing()), padding: pad, duration: 900, essential: true });
    }
  }, [user, follow, guard]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && !follow) map.easeTo({ pitch: 0, bearing: 0, padding: { top: 0, left: 0, right: 0, bottom: 0 }, duration: 600 });
  }, [follow]);

  const dest = useMapUi((s) => s.dest);
  useEffect(() => {
    const map = mapRef.current, m = destMarker.current;
    if (!map || !m) return;
    if (!dest) { m.remove(); return; }
    m.setLngLat([dest.lng, dest.lat]).addTo(map);
  }, [dest]);

  const fit = useMapUi((s) => s.fit);
  useEffect(() => {
    if (fit && mapRef.current) mapRef.current.fitBounds(fit.bounds, { padding: { top: 130, bottom: 400, left: 40, right: 40 }, duration: 800, maxZoom: 16.5 });
  }, [fit]);
  const flyTo = useMapUi((s) => s.flyTo);
  useEffect(() => {
    if (flyTo && mapRef.current) mapRef.current.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: flyTo.zoom, duration: 900 });
  }, [flyTo]);
  useEffect(() => { if (!hidden) mapRef.current?.resize(); }, [hidden]);

  // MapLibre's CSS forces position:relative on its container, so the sizing lives on a wrapper
  return (
    <div className="absolute inset-0" style={{ visibility: hidden ? "hidden" : "visible" }}>
      <div ref={box} data-testid="map" className="h-full w-full" aria-label="Safety map" role="application" />
    </div>
  );
}
