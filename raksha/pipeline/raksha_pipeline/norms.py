"""National normalisation scales (P95 of weighted POI activity / building counts), measured on the city extracts and then FIXED.

    python -m raksha_pipeline.norms        → config/norms.json
Every later run (cities and state tiles) passes these to compute_features, so a cell's activity score means the same thing everywhere.
"""
from __future__ import annotations
import json
import statistics
from pathlib import Path
from . import fetch_pbf
from .features import compute_features
from .io import load_all, load_city

NORMS = Path(__file__).resolve().parents[1] / "config" / "norms.json"


def load_norms() -> dict[str, float] | None:
    return json.loads(NORMS.read_text())["norms"] if NORMS.exists() else None


def main() -> None:
    import h3
    per_city = {}
    for cid in load_all():
        city = load_city(cid)
        if not city.get("pbf"):
            continue
        s, w, n, e = city["bbox"]
        osm = fetch_pbf.fetch(city)
        cover = set(h3.polygon_to_cells(h3.LatLngPoly([(s, w), (s, e), (n, e), (n, w)]), city["h3_res"]))
        used: dict[str, float] = {}
        compute_features(osm, cover, city["h3_res"], ((s + n) / 2, (w + e) / 2), norms=None, norms_out=used)
        per_city[cid] = used
        print(cid, {k: round(v, 2) for k, v in used.items()})
    keys = ["act_day", "act_night", "built"]
    norms = {k: round(statistics.median(c[k] for c in per_city.values()), 3) for k in keys}
    NORMS.write_text(json.dumps({"v": 1, "norms": norms, "per_city": per_city, "method": "median of per-city P95 over the extracted cities"}, indent=1))
    print("national norms:", norms)


if __name__ == "__main__":
    main()
