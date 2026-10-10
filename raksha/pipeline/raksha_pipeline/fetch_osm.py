"""Overpass extraction for one city. Raw JSON is cached; never refetched unless refresh=True."""
from __future__ import annotations
import json
import sys
import time
import requests
from .io import RAW_DIR

MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
UA = {"User-Agent": "raksha-hackathon/0.1 (HackOverflow 10.0 project)"}

AMENITIES = ("police|hospital|clinic|pharmacy|fuel|restaurant|cafe|fast_food|bank|atm|marketplace|"
             "place_of_worship|school|college|university|cinema|bus_station|toilets")
LANDUSE = "industrial|construction|brownfield|greenfield|quarry|railway|cemetery|forest|military"


def queries(bbox: list[float]) -> dict[str, str]:
    bb = ",".join(str(x) for x in bbox)
    head = "[out:json][timeout:120];"
    return {
        "roads": f"{head}way[highway]({bb});out geom;",
        "pois": f"""{head}(
          nwr[amenity~"^({AMENITIES})$"]({bb});
          nwr[shop]({bb}); nwr[office]({bb});
          nwr[public_transport~"^(station|platform)$"]({bb});
          nwr[railway~"^(station|halt|subway_entrance)$"]({bb});
          nwr[highway=bus_stop]({bb}); nwr[tourism=hotel]({bb});
        );out center tags;""",
        "buildings": f"{head}way[building]({bb});out ids center qt;",
        "areas": f"""{head}(
          way[landuse~"^({LANDUSE})$"]({bb}); rel[landuse~"^({LANDUSE})$"]({bb});
          way[natural~"^(wood|scrub|wetland)$"]({bb}); rel[natural~"^(wood|scrub|wetland)$"]({bb});
          way[leisure~"^(park|nature_reserve)$"]({bb}); rel[leisure~"^(park|nature_reserve)$"]({bb});
        );out geom;""",
    }


def _run(query: str, attempts: int = 8) -> list[dict]:
    for i in range(attempts):
        url = MIRRORS[i % len(MIRRORS)]
        try:
            r = requests.post(url, data={"data": query}, headers=UA, timeout=240)
            if r.status_code == 200 and r.text.lstrip().startswith("{"):
                js = r.json()
                if "runtime error" not in js.get("remark", ""):
                    return js["elements"]
            print(f"  overpass {url} -> {r.status_code}, retrying", file=sys.stderr)
        except (requests.RequestException, ValueError) as e:
            print(f"  overpass {url} failed: {e}", file=sys.stderr)
        time.sleep(min(30, 5 * (i + 1)))
    raise RuntimeError("Overpass unavailable after retries")


TILE_DEG = 0.1


def tiles(bbox: list[float]) -> list[list[float]]:
    """Split a bbox into ≤ TILE_DEG tiles (row-major)."""
    s, w, n, e = bbox
    out, lat = [], s
    while lat < n - 1e-9:
        lat2, lng = min(lat + TILE_DEG, n), w
        while lng < e - 1e-9:
            lng2 = min(lng + TILE_DEG, e)
            out.append([round(lat, 5), round(lng, 5), round(lat2, 5), round(lng2, 5)])
            lng = lng2
        lat = lat2
    return out


def tiles_n(bbox: list[float], n: int) -> list[list[float]]:
    s, w, nn, e = bbox
    dlat, dlng = (nn - s) / n, (e - w) / n
    return [[round(s + a * dlat, 5), round(w + b * dlng, 5), round(s + (a + 1) * dlat, 5), round(w + (b + 1) * dlng, 5)] for a in range(n) for b in range(n)]


def _merge(parts: list[dict]) -> dict:
    """Union of tile results, de-duplicated by (type, id) — ways that cross a tile edge appear in both tiles."""
    out: dict[str, dict] = {}
    for key in ("roads", "pois", "buildings", "areas"):
        seen: dict[tuple, dict] = {}
        for p in parts:
            for el in p.get(key, []):
                seen[(el["type"], el["id"])] = el
        out[key] = list(seen.values())
    return out


def fetch(city: dict, refresh: bool = False) -> dict:
    """Tiled, resumable fetch. Each tile is cached in data/raw/<city>/tile_<i>.json so a flaky run can simply be re-run."""
    cache_dir = RAW_DIR / city["id"]
    cache_dir.mkdir(parents=True, exist_ok=True)
    parts = []
    tl = tiles(city["bbox"])
    for i, tb in enumerate(tl):
        f = cache_dir / f"tile_{i:03d}.json"
        if f.exists() and not refresh:
            parts.append(json.loads(f.read_text())); continue
        got = {}
        for name, q in queries(tb).items():
            if name == "buildings":
                continue
            print(f"[{city['id']}] tile {i + 1}/{len(tl)} {name} ...", file=sys.stderr, flush=True)
            got[name] = _run(q)
            time.sleep(1.0)  # be polite to the public instances
        got["buildings"] = []
        for q4 in tiles_n(tb, 2):  # dense metros: 4 quadrants keep each query small
            print(f"[{city['id']}] tile {i + 1}/{len(tl)} buildings {q4[:2]} ...", file=sys.stderr, flush=True)
            got["buildings"] += _run(queries(q4)["buildings"])
            time.sleep(1.0)
        f.write_text(json.dumps(got))
        parts.append(got)
    return _merge(parts)


if __name__ == "__main__":
    from .io import load_city
    fetch(load_city(sys.argv[1] if len(sys.argv) > 1 else "mumbai"))
