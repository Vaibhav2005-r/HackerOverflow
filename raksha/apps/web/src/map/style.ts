import type { StyleSpecification, LayerSpecification } from "maplibre-gl";

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
let base: StyleSpecification | null = null;

/** Plain background so hexes/routes still render when tiles can't load (offline). */
export const fallbackStyle = (night: boolean): StyleSpecification => ({
  version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": night ? "#0f1020" : "#f2f1f8" } }],
});

export async function loadBaseStyle(): Promise<StyleSpecification | null> {
  if (base) return base;
  try {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(STYLE_URL, { signal: ctl.signal }); clearTimeout(to);
    if (!r.ok) throw new Error(String(r.status));
    base = (await r.json()) as StyleSpecification;
  } catch { base = null; }
  return base;
}

/** Handoff map styling: land #0F0E1A, blocks #13121F, minor roads #23203A, major #363150, water #0A1124, labels #7A7493 caps. */
const N = { land: "#0F0E1A", block: "#13121F", road: "#23203A", major: "#363150", water: "#0A1124", label: "#7A7493" };

export function toNight(style: StyleSpecification): StyleSpecification {
  const s = structuredClone(style);
  s.layers = s.layers.map((l: LayerSpecification) => {
    const id = l.id.toLowerCase();
    const p = ((l as { paint?: Record<string, unknown> }).paint ??= {});
    switch (l.type) {
      case "background": p["background-color"] = N.land; break;
      case "fill": p["fill-color"] = id.includes("water") ? N.water : id.includes("building") ? N.block : N.land; delete p["fill-outline-color"]; break;
      case "line": p["line-color"] = id.includes("water") ? N.water : id.includes("casing") ? N.land : id.includes("motorway") || id.includes("trunk") || id.includes("primary") || id.includes("secondary") ? N.major : N.road; break;
      case "symbol": {
        p["text-color"] = N.label; p["text-halo-color"] = N.land;
        const lay = ((l as { layout?: Record<string, unknown> }).layout ??= {});
        lay["text-transform"] = "uppercase"; lay["text-size"] = 10;
        break;
      }
      case "fill-extrusion": p["fill-extrusion-color"] = N.block; break;
    }
    return l;
  });
  return s;
}
