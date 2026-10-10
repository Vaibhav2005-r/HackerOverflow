import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MLMap, Marker } from "maplibre-gl";
import { Phone } from "lucide-react";
import { EMERGENCY, telLink } from "@raksha/core";
import type { ShareView as View } from "../services/backend/types";
import { getShareClient } from "../services/shareClient";
import { fallbackStyle, loadBaseStyle, toNight } from "../map/style";
import { useT } from "../i18n";
import "../styles/tokens.css";

const ago = (t: number) => { const s = Math.max(0, Math.round((Date.now() - t) / 1000)); return s < 60 ? `${s}s ago` : `${Math.round(s / 60)} min ago`; };

/** Contact live view (/s/:token). No auth, no app chrome: map, trail, status, and 112 one tap away. */
export default function ShareView({ token }: { token: string }) {
  const t = useT();
  const [view, setView] = useState<View | null | undefined>(undefined);
  const [, tick] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const ml = useRef<typeof import("maplibre-gl") | null>(null);

  useEffect(() => {
    const m = document.createElement("meta"); m.name = "referrer"; m.content = "no-referrer"; document.head.appendChild(m);
    document.documentElement.dataset.theme = "night";
    const b = getShareClient();
    const load = () => void b.getShareView(token).then(setView).catch(() => setView(null));
    load();
    const un = b.subscribeShare(token, load);
    const i = setInterval(() => tick((x) => x + 1), 5000);
    return () => { un(); clearInterval(i); m.remove(); };
  }, [token]);

  useEffect(() => {
    let dead = false;
    void (async () => {
      const [lib] = await Promise.all([import("maplibre-gl"), import("maplibre-gl/dist/maplibre-gl.css")]);
      if (dead || !box.current) return;
      ml.current = lib;
      const base = await loadBaseStyle();
      const style = base ? toNight(base) : fallbackStyle(true);
      const mp = (map.current = new lib.Map({ container: box.current, style, center: [72.857, 19.19], zoom: 15, attributionControl: { compact: true } }));
      mp.on("load", () => {
        mp.addSource("trail", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        mp.addLayer({ id: "trail", type: "line", source: "trail", paint: { "line-color": "#ef5d8c", "line-width": 5, "line-opacity": 0.85 }, layout: { "line-cap": "round", "line-join": "round" } });
        setView((v) => (v ? { ...v } : v));
      });
    })();
    return () => { dead = true; map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const mp = map.current, lib = ml.current;
    if (!mp || !lib || !view?.last || !mp.getSource("trail")) return;
    (mp.getSource("trail") as GeoJSONSource).setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: view.trail.map((p) => [p.lng, p.lat]) } });
    if (!marker.current) {
      const el = document.createElement("div"); el.className = "user-marker"; el.dataset.state = "sos"; el.innerHTML = '<div class="u-acc"></div><div class="u-pulse"></div><div class="u-dot"></div>';
      marker.current = new lib.Marker({ element: el });
    }
    marker.current.setLngLat([view.last.lng, view.last.lat]).addTo(mp);
    mp.easeTo({ center: [view.last.lng, view.last.lat], duration: 800 });
  }, [view]);

  if (view === null) return <div className="grid h-full place-items-center bg-bg-0 p-8 text-center text-text-1" data-testid="share-notfound"><p className="text-lg">{t("sv.notfound")}</p></div>;
  const active = view?.status === "active";
  return (
    <div className="flex h-full flex-col bg-bg-0 text-text-1" data-testid="share-view">
      <header className="safe-top px-5 pb-3 pt-4">
        <h1 className="text-xl font-extrabold" data-testid="sv-title">{view ? t("sv.title", { name: view.name }) : "…"}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          {view && <span className="chip" data-testid="sv-status" style={{ background: active ? (view.kind === "sos" ? "var(--sos)" : "color-mix(in srgb, var(--cls-comfortable) 25%, transparent)") : undefined, color: active && view.kind === "sos" ? "#fff" : undefined }}>{view.kind === "sos" && active ? t("sv.sos") : active ? t("sv.active") : t("sv.ended")}</span>}
          {view?.coercion && active && <span className="chip !bg-extra-care !text-white" data-testid="sv-coercion">{t("sv.coercion")}</span>}
          {view?.last?.battery != null && <span className="chip">{t("sv.battery", { p: Math.round(view.last.battery * 100) })}</span>}
        </div>
        <p className="mt-2 text-sm text-text-2" data-testid="sv-last">{view?.last ? t("sv.last", { t: ago(view.last.t) }) : t("sv.waiting")}</p>
      </header>
      <div className="relative min-h-0 flex-1"><div className="absolute inset-0"><div ref={box} className="h-full w-full" data-testid="sv-map" /></div></div>
      <footer className="safe-bottom grid grid-cols-1 gap-2 px-5 pt-3">
        <a className="btn btn-sos btn-lg" href={telLink(EMERGENCY.police)}><Phone />{t("sv.call112")}</a>
      </footer>
    </div>
  );
}
