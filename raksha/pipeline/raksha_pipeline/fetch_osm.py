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
    head = "[out:json][timeout:180];"
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


def _run(query: str, attempts: int = 12) -> list[dict]:
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
        time.sleep(min(60, 8 * (i + 1)))
    raise RuntimeError("Overpass unavailable after retries")


def fetch(city: dict, refresh: bool = False) -> dict:
    cache = RAW_DIR / f"osm_{city['id']}.json"
    if cache.exists() and not refresh:
        return json.loads(cache.read_text())
    out = {}
    for name, q in queries(city["bbox"]).items():
        print(f"fetching {name} ...", file=sys.stderr)
        out[name] = _run(q)
        print(f"  {name}: {len(out[name])} elements", file=sys.stderr)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(out))
    return out


if __name__ == "__main__":
    from .io import load_city
    fetch(load_city(sys.argv[1] if len(sys.argv) > 1 else "mumbai_demo"))
