"""python -m raksha_pipeline.run --city mumbai_demo [--refresh]"""
from __future__ import annotations
import argparse
import datetime as dt
import subprocess
import h3
from .io import ROOT, WEB_DATA, load_city, write_json, RAW_DIR
from .fetch_osm import fetch
from .features import compute_features
from .safe_spots import extract


def cover(bbox, res) -> set[str]:
    s, w, n, e = bbox
    poly = h3.LatLngPoly([(s, w), (s, e), (n, e), (n, w)])
    return set(h3.polygon_to_cells(poly, res))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default="mumbai_demo")
    ap.add_argument("--refresh", action="store_true")
    a = ap.parse_args()
    city = load_city(a.city)
    res = city["h3_res"]; s, w, n, e = city["bbox"]
    osm = fetch(city, a.refresh)
    feats, pois = compute_features(osm, cover(city["bbox"], res), res, ((s + n) / 2, (w + e) / 2))
    out_dir = WEB_DATA / a.city
    feat_path = RAW_DIR / f"features_{a.city}.json"
    write_json(feat_path, {"city": a.city, "name": city["name"], "bbox": city["bbox"], "res": res,
                           "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
                           "cells": feats})
    spots = extract(pois)
    write_json(out_dir / "safe_spots.json", {"v": 1, "city": a.city, "spots": spots})
    print(f"{len(feats)} cells, {len(spots)} safe spots")
    subprocess.run(["pnpm", "--filter", "@raksha/core", "build-cells", str(feat_path), str(out_dir)],
                   cwd=ROOT, check=True)


if __name__ == "__main__":
    main()
