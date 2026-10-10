"""python -m raksha_pipeline.run --city mumbai [--refresh]   |   --city all"""
from __future__ import annotations
import argparse
import datetime as dt
import subprocess
import h3
import json
from .io import ROOT, WEB_DATA, load_city, load_all, write_json, RAW_DIR
from . import fetch_osm, fetch_pbf
from .features import compute_features
from .safe_spots import extract


def cover(bbox, res) -> set[str]:
    s, w, n, e = bbox
    poly = h3.LatLngPoly([(s, w), (s, e), (n, e), (n, w)])
    return set(h3.polygon_to_cells(poly, res))


def build_index() -> None:
    """public/data/index.json: the catalogue of city packs the app can load (id, name, bbox, size, version)."""
    packs = []
    for meta in sorted(WEB_DATA.glob("*/meta.json")):
        m = json.loads(meta.read_text())
        packs.append({"id": m["city"], "name": m["name"], "bbox": m["bbox"], "cells": m["cellCount"], "version": m["generated_at"]})
    write_json(WEB_DATA / "index.json", {"v": 1, "cities": packs})
    print(f"index.json: {[p['id'] for p in packs]}")


def run_city(city_id: str, refresh: bool) -> None:
    city = load_city(city_id)
    res = city["h3_res"]; s, w, n, e = city["bbox"]
    # regional Geofabrik extract when available (reliable, offline-processable); public Overpass otherwise
    use_pbf = city.get("pbf") and (fetch_pbf.PBF_DIR / f"{city['pbf']}.osm.pbf").exists()
    osm = (fetch_pbf if use_pbf else fetch_osm).fetch(city, refresh)
    feats, pois = compute_features(osm, cover(city["bbox"], res), res, ((s + n) / 2, (w + e) / 2))
    out_dir = WEB_DATA / city_id
    feat_path = RAW_DIR / f"features_{city_id}.json"
    write_json(feat_path, {"city": city_id, "name": city["name"], "bbox": city["bbox"], "res": res,
                           "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
                           "cells": feats})
    spots = extract(pois)
    write_json(out_dir / "safe_spots.json", {"v": 1, "city": city_id, "spots": spots})
    print(f"{city_id}: {len(feats)} cells, {len(spots)} safe spots")
    subprocess.run(["pnpm", "--filter", "@raksha/core", "build-cells", str(feat_path), str(out_dir)], cwd=ROOT, check=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="mumbai", help="a city id from config/cities.yaml, or 'all'")
    ap.add_argument("--refresh", action="store_true")
    a = ap.parse_args()
    for cid in (load_all() if a.city == "all" else [a.city]):
        try:
            run_city(cid, a.refresh)
        except Exception as e:  # one flaky city must not lose the others
            print(f"!! {cid} failed: {e}")
    build_index()


if __name__ == "__main__":
    main()
