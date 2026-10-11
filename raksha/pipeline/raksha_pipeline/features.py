"""Per-cell feature extraction (spec §5.3). All features normalised to 0..1.
Python extracts features only; scoring lives in packages/core."""
from __future__ import annotations
import math
import re
from collections import defaultdict
import h3
import numpy as np
from scipy.spatial import cKDTree
from shapely.geometry import Point, Polygon
from shapely.strtree import STRtree

SAMPLE_M = 10.0

LIGHT_PRIOR = {"trunk": .85, "primary": .85, "secondary": .75, "tertiary": .60, "residential": .45,
               "living_street": .45, "unclassified": .35, "service": .35, "footway": .25, "path": .25,
               "steps": .25, "pedestrian": .25, "track": .10}
ROAD_OPEN = {"trunk": 1.0, "primary": 1.0, "secondary": 1.0, "tertiary": .85, "residential": .65,
             "living_street": .65, "unclassified": .55, "service": .40, "pedestrian": .70,
             "footway": .35, "path": .35, "steps": .30, "track": .15}
LIT_YES = {"yes", "24/7", "automatic"}

DAY_W = {"shop": 1.0, "food": 1.0, "bank": .7, "atm": .7, "office": .7, "education": .8,
         "marketplace": 2.0, "worship": .5}
ISO_ALWAYS = {("landuse", v) for v in "industrial construction brownfield greenfield quarry railway military forest cemetery".split()} | \
             {("natural", v) for v in "wood scrub wetland".split()}
ISO_PARK = {("leisure", "park"), ("leisure", "nature_reserve")}


# ---------- projection ----------
class Proj:
    def __init__(self, lat0: float, lng0: float):
        self.lat0, self.lng0 = lat0, lng0
        self.kx = 111_320 * math.cos(math.radians(lat0))
        self.ky = 110_574

    def xy(self, lat, lng):
        return (lng - self.lng0) * self.kx, (lat - self.lat0) * self.ky


# ---------- classification helpers ----------
def light_value(tags: dict) -> tuple[float, bool]:
    """Returns (light 0..1, explicitly_tagged)."""
    lit = tags.get("lit")
    if lit in LIT_YES:
        return 1.0, True
    if lit == "no":
        return 0.0, True
    v = LIGHT_PRIOR.get(tags.get("highway", ""), .35)
    if tags.get("tunnel") == "yes" or tags.get("covered") == "yes":
        v *= .6
    return v, False


def poi_kind(t: dict) -> str | None:
    a = t.get("amenity")
    if a in ("police", "hospital"): return a
    if a in ("clinic", "pharmacy"): return "health"
    if a == "fuel": return "fuel"
    if a in ("restaurant", "cafe", "fast_food"): return "food"
    if a in ("bank",): return "bank"
    if a == "atm": return "atm"
    if a == "marketplace": return "marketplace"
    if a == "place_of_worship": return "worship"
    if a in ("school", "college", "university"): return "education"
    if a == "cinema": return "cinema"
    if a == "bus_station": return "station"
    if a == "toilets": return None
    if t.get("railway") in ("station", "halt", "subway_entrance") or t.get("public_transport") == "station":
        return "station"
    if t.get("highway") == "bus_stop" or t.get("public_transport") == "platform":
        return "busstop"
    if "shop" in t: return "shop"
    if "office" in t: return "office"
    if t.get("tourism") == "hotel": return "hotel"
    return None


_CLOSE = re.compile(r"-\s*(\d{1,2})[:.](\d{2})")


def is_late(hours: str | None) -> bool:
    """True if opening_hours suggests closing at/after 23:00 (or past midnight)."""
    if not hours:
        return False
    for h, _m in _CLOSE.findall(hours):
        h = int(h)
        if h >= 23 or h <= 3:
            return True
    return False


def night_weight(kind: str, t: dict) -> float:
    hours = t.get("opening_hours")
    if hours and "24/7" in hours: return 1.0
    if kind in ("hospital", "police"): return 1.0
    if is_late(hours): return .8
    if kind == "station": return .7
    if kind == "fuel" and not hours: return .5
    if kind == "food" and not hours: return .2
    return 0.0


def day_weight(kind: str) -> float:
    return DAY_W.get(kind, 0.0)


# ---------- geometry ----------
def densify(coords: list[tuple[float, float]], step: float):
    """Yield (x, y, seg_len_weight) sample points every `step` metres along an xy polyline."""
    out = []
    carry = step / 2
    for (x0, y0), (x1, y1) in zip(coords, coords[1:]):
        d = math.hypot(x1 - x0, y1 - y0)
        if d == 0:
            continue
        pos = carry
        while pos < d:
            f = pos / d
            out.append((x0 + (x1 - x0) * f, y0 + (y1 - y0) * f))
            pos += step
        carry = pos - d
    return out


def pct95(vals: list[float]) -> float:
    return float(np.percentile(vals, 95)) if vals else 1.0


def normalise(raw: dict[str, float], p95: float | None = None) -> tuple[dict[str, float], float]:
    """log1p(x)/log1p(P95), clipped to 1. `p95` is the scale; with None it is measured from this area (per-city mode).
    Tiles of a state use ONE national scale (config/norms.json) — otherwise a village with three shops would score like a market."""
    pos = [v for v in raw.values() if v > 0]
    p95 = p95 if p95 is not None else pct95(pos)
    denom = math.log1p(p95) or 1.0
    return {k: min(1.0, math.log1p(v) / denom) for k, v in raw.items()}, p95


def with_neighbours(own: dict[str, float], res: int) -> dict[str, float]:
    """own + 0.5 × sum over the 6 neighbours."""
    out = defaultdict(float)
    for c, v in own.items():
        out[c] += v
        for n in h3.grid_ring(c, 1):
            out[n] += 0.5 * v
    return out


# ---------- main ----------
def compute_features(osm: dict, cells_cover: set[str], res: int, centre: tuple[float, float],
                     norms: dict[str, float] | None = None, norms_out: dict[str, float] | None = None) -> tuple[list[dict], list[dict]]:
    """Returns (features list, safe-spot-source POIs)."""
    proj = Proj(*centre)

    # roads → per-cell length, light, road openness
    length = defaultdict(float); light_sum = defaultdict(float)
    road_sum = defaultdict(float); tagged_len = defaultdict(float)
    for w in osm.get("roads", []):
        t = w.get("tags", {})
        hw = t.get("highway")
        if hw not in ROAD_OPEN or not w.get("geometry"):
            continue
        if t.get("access") in ("private", "no") and hw == "service":
            continue
        lv, tagged = light_value(t)
        ro = ROAD_OPEN[hw]
        pts = [proj.xy(g["lat"], g["lon"]) for g in w["geometry"]]
        for x, y in densify(pts, SAMPLE_M):
            lat = proj.lat0 + y / proj.ky; lng = proj.lng0 + x / proj.kx
            c = h3.latlng_to_cell(lat, lng, res)
            length[c] += SAMPLE_M; light_sum[c] += lv * SAMPLE_M
            road_sum[c] += ro * SAMPLE_M
            if tagged: tagged_len[c] += SAMPLE_M

    # POIs
    pois = []
    for e in osm.get("pois", []):
        lat = e.get("lat") or (e.get("center") or {}).get("lat")
        lng = e.get("lon") or (e.get("center") or {}).get("lon")
        if lat is None: continue
        t = e.get("tags", {})
        kind = poi_kind(t)
        if kind is None: continue
        pois.append({"kind": kind, "lat": lat, "lng": lng, "tags": t, "h3": h3.latlng_to_cell(lat, lng, res)})

    day_raw = defaultdict(float); night_raw = defaultdict(float); poi_cnt = defaultdict(int)
    for p in pois:
        poi_cnt[p["h3"]] += 1
        dw = day_weight(p["kind"]); nw = night_weight(p["kind"], p["tags"])
        if dw: day_raw[p["h3"]] += dw
        if nw: night_raw[p["h3"]] += nw

    # buildings
    bcount = defaultdict(int)
    for b in osm.get("buildings", []):
        c = b.get("center")
        if c: bcount[h3.latlng_to_cell(c["lat"], c["lon"], res)] += 1

    cells = {c for c in cells_cover if length.get(c) or poi_cnt.get(c) or bcount.get(c)}

    n = norms or {}
    act_day, p_day = normalise(with_neighbours(day_raw, res), n.get("act_day"))
    act_night, p_night = normalise(with_neighbours(night_raw, res), n.get("act_night"))
    built, p_built = normalise({c: float(v) for c, v in bcount.items()}, n.get("built"))
    if norms_out is not None:
        norms_out.update({"act_day": p_day, "act_night": p_night, "built": p_built})

    # distance features (projected metres, KD-trees)
    def tree(pred):
        pts = [proj.xy(p["lat"], p["lng"]) for p in pois if pred(p)]
        return cKDTree(pts) if pts else None

    def nearest(tr, x, y):
        return float(tr.query([x, y])[0]) if tr is not None else float("inf")

    t_police = tree(lambda p: p["kind"] == "police")
    t_hosp = tree(lambda p: p["kind"] == "hospital")
    t_fuel = tree(lambda p: p["kind"] == "fuel" and night_weight("fuel", p["tags"]) >= .5)
    t_station = tree(lambda p: p["kind"] == "station")
    t_bus = tree(lambda p: p["kind"] == "busstop")

    # isolation areas
    polys, pclass = [], []
    def add_poly(ring, cls):
        if len(ring) >= 4:
            try:
                pg = Polygon([proj.xy(la, lo) for la, lo in ring])
                if pg.is_valid and not pg.is_empty:
                    polys.append(pg); pclass.append(cls)
            except ValueError:
                pass
    for a in osm.get("areas", []):
        t = a.get("tags", {})
        cls = None
        for k in ("landuse", "natural", "leisure"):
            if (k, t.get(k)) in ISO_ALWAYS: cls = "always"
            elif (k, t.get(k)) in ISO_PARK: cls = "park"
        if cls is None: continue
        if a["type"] == "way" and a.get("geometry"):
            add_poly([(g["lat"], g["lon"]) for g in a["geometry"]], cls)
        elif a["type"] == "relation":
            for m in a.get("members", []):
                if m.get("role") == "outer" and m.get("geometry"):
                    ring = [(g["lat"], g["lon"]) for g in m["geometry"]]
                    if ring[0] == ring[-1]: add_poly(ring, cls)
    strtree = STRtree(polys) if polys else None

    def iso(c):
        lat, lng = h3.cell_to_latlng(c)
        verts = h3.cell_to_boundary(c)
        probes = [(lat, lng)] + [((lat + vl) / 2, (lng + vg) / 2) for vl, vg in verts]
        d = n = 0.0
        for la, lo in probes:
            x, y = proj.xy(la, lo); pt = Point(x, y)
            kinds = set()
            if strtree is not None:
                for i in strtree.query(pt, predicate="within"):
                    kinds.add(pclass[i])
            d += 1.0 if "always" in kinds else (.5 if "park" in kinds else 0.0)
            n += 1.0 if kinds else 0.0
        return d / len(probes), n / len(probes)

    out = []
    for c in sorted(cells):
        lat, lng = h3.cell_to_latlng(c)
        x, y = proj.xy(lat, lng)
        L = length.get(c, 0.0)
        d_pol, d_hos, d_fuel = nearest(t_police, x, y), nearest(t_hosp, x, y), nearest(t_fuel, x, y)
        help_ = max(math.exp(-d_pol / 600), .8 * math.exp(-d_hos / 800), .6 * math.exp(-d_fuel / 500))
        transit = max(math.exp(-nearest(t_station, x, y) / 500), .7 * math.exp(-nearest(t_bus, x, y) / 300))
        iso_d, iso_n = iso(c)
        nb_any = sum(1 for n in h3.grid_disk(c, 1) if poi_cnt.get(n) or bcount.get(n))
        out.append({
            "h3": c,
            "light": round(light_sum[c] / L, 4) if L else 0.0,
            "light_tagged_frac": round(tagged_len[c] / L, 4) if L else 0.0,
            "road": round(road_sum[c] / L, 4) if L else 0.0,
            "act_day": round(act_day.get(c, 0.0), 4), "act_night": round(act_night.get(c, 0.0), 4),
            "help": round(help_, 4), "transit": round(transit, 4),
            "built": round(built.get(c, 0.0), 4),
            "iso_day": round(iso_d, 4), "iso_night": round(iso_n, 4),
            "poi_any": 1 if (poi_cnt.get(c) or bcount.get(c)) else 0,
            "poi_k1": nb_any,
            "road_len_m": round(L),
        })
    return out, pois
