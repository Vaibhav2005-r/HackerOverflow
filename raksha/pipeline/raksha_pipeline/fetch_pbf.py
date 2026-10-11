"""OSM data from Geofabrik regional extracts, processed locally with osmium-tool.

Why: the public Overpass servers throttle (429/504) and are unreliable for city-sized areas. A regional extract is a single
free download, reproducible, updated daily, and processing it needs no network. The output has exactly the shape of the
Overpass source ({roads, pois, buildings, areas}), so features.py is unchanged.
"""
from __future__ import annotations
import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Iterable, Iterator
from .io import RAW_DIR

PBF_DIR = RAW_DIR / "pbf"
GEOFABRIK = "https://download.geofabrik.de/asia/india/{zone}-latest.osm.pbf"

AMENITIES = ("police,hospital,clinic,pharmacy,fuel,restaurant,cafe,fast_food,bank,atm,marketplace,"
             "place_of_worship,school,college,university,cinema,bus_station,toilets")
LANDUSE = "industrial,construction,brownfield,greenfield,quarry,railway,cemetery,forest,military"

FILTERS = {
    "roads": ["w/highway"],
    "pois": [f"nwr/amenity={AMENITIES}", "nwr/shop", "nwr/office", "nwr/public_transport=station,platform",
             "nwr/railway=station,halt,subway_entrance", "nwr/highway=bus_stop", "nwr/tourism=hotel"],
    "buildings": ["w/building"],
    "areas": [f"wr/landuse={LANDUSE}", "wr/natural=wood,scrub,wetland", "wr/leisure=park,nature_reserve"],
}


# ---------- pure conversion (unit-tested) ----------
def features(lines: Iterable[str]) -> Iterator[dict]:
    """GeoJSON text sequence (optionally RS-prefixed, as osmium writes it) → feature dicts."""
    for ln in lines:
        ln = ln.strip().lstrip("\x1e")
        if ln:
            try:
                yield json.loads(ln)
            except json.JSONDecodeError:
                continue  # a truncated last line must not kill the run


def _ring_center(ring: list[list[float]]) -> tuple[float, float]:
    n = max(1, len(ring) - 1) if len(ring) > 1 and ring[0] == ring[-1] else max(1, len(ring))
    pts = ring[:n]
    return sum(p[1] for p in pts) / n, sum(p[0] for p in pts) / n  # lat, lon


def _center(geom: dict) -> tuple[float, float] | None:
    t, c = geom.get("type"), geom.get("coordinates")
    if not c:
        return None
    if t == "Point":
        return c[1], c[0]
    if t == "LineString":
        return _ring_center(c)
    if t == "Polygon":
        return _ring_center(c[0])
    if t == "MultiPolygon":
        return _ring_center(max((p[0] for p in c), key=len))   # centre of the largest part
    return None


def roads(feats: Iterable[dict]) -> list[dict]:
    out = []
    for i, f in enumerate(feats):
        g = f.get("geometry") or {}
        if g.get("type") != "LineString":
            continue
        out.append({"type": "way", "id": f.get("id", i), "tags": f.get("properties", {}),
                    "geometry": [{"lat": c[1], "lon": c[0]} for c in g["coordinates"]]})
    return out


# osmium exports a closed way twice — as a LineString (the way) and as a Polygon (the derived area). Points and areas only,
# otherwise every building / area-POI would be counted double.
_NOT_LINE = ("Point", "Polygon", "MultiPolygon")


def pois(feats: Iterable[dict]) -> list[dict]:
    out = []
    for i, f in enumerate(feats):
        g = f.get("geometry") or {}
        ctr = _center(g) if g.get("type") in _NOT_LINE else None
        if ctr:
            out.append({"type": "node", "id": f.get("id", i), "lat": ctr[0], "lon": ctr[1], "tags": f.get("properties", {})})
    return out


def buildings(feats: Iterable[dict]) -> list[dict]:
    out = []
    for i, f in enumerate(feats):
        g = f.get("geometry") or {}
        ctr = _center(g) if g.get("type") in ("Polygon", "MultiPolygon") else None
        if ctr:
            out.append({"type": "way", "id": f.get("id", i), "center": {"lat": ctr[0], "lon": ctr[1]}})
    return out


def areas(feats: Iterable[dict]) -> list[dict]:
    """Each polygon (outer ring) becomes a closed 'way', the shape features.py reads."""
    out = []
    for i, f in enumerate(feats):
        g = f.get("geometry") or {}
        polys = [g["coordinates"]] if g.get("type") == "Polygon" else g.get("coordinates", []) if g.get("type") == "MultiPolygon" else []
        for j, poly in enumerate(polys):
            if poly and len(poly[0]) >= 4:
                out.append({"type": "way", "id": f"{f.get('id', i)}-{j}", "tags": f.get("properties", {}),
                            "geometry": [{"lat": c[1], "lon": c[0]} for c in poly[0]]})
    return out


CONVERT = {"roads": roads, "pois": pois, "buildings": buildings, "areas": areas}


# ---------- osmium plumbing ----------
def _run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL)


def ensure_pbf(zone: str) -> Path:
    path = PBF_DIR / f"{zone}.osm.pbf"
    if not path.exists():
        raise SystemExit(f"{path} missing — download {GEOFABRIK.format(zone=zone)} into data/raw/pbf/ (about 200–550 MB)")
    return path


def layers_from_pbf(base: Path, work: Path) -> dict[str, list]:
    """Filter + export + convert the four layers of an (already bbox-extracted) PBF."""
    out: dict[str, list] = {}
    for layer, flt in FILTERS.items():
        filtered, gj = work / f"{layer}.pbf", work / f"{layer}.geojsonseq"
        _run(["osmium", "tags-filter", "-O", "-o", str(filtered), str(base), *flt])
        _run(["osmium", "export", "-O", "-f", "geojsonseq", "--add-unique-id=type_id", "-o", str(gj), str(filtered)])
        with gj.open(encoding="utf-8") as fh:
            out[layer] = CONVERT[layer](features(fh))
    return out


def fetch(city: dict, refresh: bool = False) -> dict:
    if shutil.which("osmium") is None:
        raise SystemExit("osmium-tool not found (brew install osmium-tool / apt install osmium-tool)")
    src = ensure_pbf(city["pbf"])
    work = RAW_DIR / "extract" / city["id"]
    work.mkdir(parents=True, exist_ok=True)
    s, w, n, e = city["bbox"]
    base = work / "base.pbf"
    if refresh or not base.exists() or base.stat().st_mtime < src.stat().st_mtime:
        print(f"[{city['id']}] extracting bbox from {src.name} ...", file=sys.stderr, flush=True)
        _run(["osmium", "extract", "-b", f"{w},{s},{e},{n}", "--strategy=smart", "-O", "-o", str(base), str(src)])
    out = layers_from_pbf(base, work)
    for layer, items in out.items():
        print(f"[{city['id']}] {layer}: {len(items)}", file=sys.stderr, flush=True)
    return out
