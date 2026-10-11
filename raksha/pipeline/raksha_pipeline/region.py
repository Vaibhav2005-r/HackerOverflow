"""State-wide safety tiles.

    python -m raksha_pipeline.region --region maharashtra [--workers 4] [--limit N]

1. cut the zone extract down to the state's bbox and to the tags we use (once);
2. walk the bbox in 0.25° chunks (with a 0.012° margin so edge cells see their neighbours), in parallel:
   extract → features (national norms) → score (national calibration) → keep the cells whose centre lies in the chunk core;
3. group cells by H3 res-5 parent and write one small JSON tile each, plus public/data/regions.json (the catalogue).
Resumable: finished chunks are cached in data/raw/region/<id>/chunks/.
"""
from __future__ import annotations
import argparse
import datetime as dt
import json
import shutil
import subprocess
import sys
import tempfile
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path
import h3
import yaml
from . import fetch_pbf
from .features import compute_features
from .io import CONFIG, RAW_DIR, ROOT, WEB_DATA, write_json
from .norms import load_norms
from .safe_spots import extract as extract_spots

REGIONS = CONFIG.parent / "regions.yaml"
CHUNK_DEG, MARGIN_DEG, RES, TILE_RES = 0.25, 0.012, 9, 5
CORE = ROOT / "packages" / "core"


def load_region(rid: str) -> dict:
    regs = yaml.safe_load(REGIONS.read_text())
    if rid not in regs:
        raise SystemExit(f"unknown region {rid!r}; have {sorted(regs)}")
    return {"id": rid, **regs[rid]}


def chunk_grid(bbox: list[float], step: float = CHUNK_DEG) -> list[list[float]]:
    s, w, n, e = bbox
    out, lat = [], s
    while lat < n - 1e-9:
        lng = w
        while lng < e - 1e-9:
            out.append([round(lat, 5), round(lng, 5), round(min(lat + step, n), 5), round(min(lng + step, e), 5)])
            lng += step
        lat += step
    return out


def in_core(lat: float, lng: float, core: list[float]) -> bool:
    return core[0] <= lat < core[2] and core[1] <= lng < core[3]


def tile_of(cell: str) -> str:
    return h3.cell_to_parent(cell, TILE_RES)


def group_into_tiles(rows: list, spots: list[dict]) -> dict[str, dict]:
    """cells (cells.json tuples) and safe spots → {tile id: {"cells": [...], "spots": [...]}}."""
    tiles: dict[str, dict] = defaultdict(lambda: {"cells": [], "spots": []})
    for r in rows:
        tiles[tile_of(r[0])]["cells"].append(r)
    for sp in spots:
        tiles[tile_of(sp["h3"])]["spots"].append(sp)
    return tiles


def process_chunk(task: tuple) -> dict | None:
    """One chunk, in a worker process. Returns the kept rows + spots (small), or None if the chunk is empty."""
    rid, idx, core, state_pbf, cache_dir, cal_path = task
    cache = Path(cache_dir) / f"{idx:04d}.json"
    if cache.exists():
        return json.loads(cache.read_text())
    s, w, n, e = core
    ext = [s - MARGIN_DEG, w - MARGIN_DEG, n + MARGIN_DEG, e + MARGIN_DEG]
    work = Path(tempfile.mkdtemp(prefix=f"raksha-{rid}-{idx}-"))
    try:
        base = work / "base.pbf"
        subprocess.run(["osmium", "extract", "-b", f"{ext[1]},{ext[0]},{ext[3]},{ext[2]}", "--strategy=smart", "-O", "-o", str(base), state_pbf],
                       check=True, stdout=subprocess.DEVNULL)
        osm = fetch_pbf.layers_from_pbf(base, work)
        if not (osm["roads"] or osm["pois"] or osm["buildings"]):
            result = None
        else:
            poly = h3.LatLngPoly([(ext[0], ext[1]), (ext[0], ext[3]), (ext[2], ext[3]), (ext[2], ext[1])])
            feats, pois = compute_features(osm, set(h3.polygon_to_cells(poly, RES)), RES, ((ext[0] + ext[2]) / 2, (ext[1] + ext[3]) / 2), norms=load_norms())
            if not feats:
                result = None
            else:
                fp, rp = work / "features.json", work / "rows.json"
                fp.write_text(json.dumps({"cells": feats}))
                subprocess.run([str(CORE / "node_modules" / ".bin" / "tsx"), "src/scoring/score-features.ts", str(fp), cal_path, str(rp)], cwd=CORE, check=True, stdout=subprocess.DEVNULL)
                rows = [r for r in json.loads(rp.read_text()) if in_core(*h3.cell_to_latlng(r[0]), core)]
                spots = [sp for sp in extract_spots(pois) if in_core(sp["lat"], sp["lng"], core)]
                result = {"rows": rows, "spots": spots}
        cache.write_text(json.dumps(result))
        return result
    finally:
        shutil.rmtree(work, ignore_errors=True)


def run_region(rid: str, workers: int = 4, limit: int | None = None) -> None:
    reg = load_region(rid)
    zone = fetch_pbf.ensure_pbf(reg["pbf"])
    cal = WEB_DATA / "calibration.json"
    if not cal.exists() or load_norms() is None:
        raise SystemExit("run `python -m raksha_pipeline.norms` and the calibrate step first (national scales)")
    base_dir = RAW_DIR / "region" / rid
    (base_dir / "chunks").mkdir(parents=True, exist_ok=True)
    s, w, n, e = reg["bbox"]
    state_pbf = base_dir / "state.pbf"
    if not state_pbf.exists() or state_pbf.stat().st_mtime < zone.stat().st_mtime:
        print(f"[{rid}] cutting state extract …", file=sys.stderr, flush=True)
        cut = base_dir / "cut.pbf"
        subprocess.run(["osmium", "extract", "-b", f"{w},{s},{e},{n}", "--strategy=smart", "-O", "-o", str(cut), str(zone)], check=True, stdout=subprocess.DEVNULL)
        flt = [f for fl in fetch_pbf.FILTERS.values() for f in fl]
        subprocess.run(["osmium", "tags-filter", "-O", "-o", str(state_pbf), str(cut), *flt], check=True, stdout=subprocess.DEVNULL)
        cut.unlink(missing_ok=True)
    chunks = chunk_grid(reg["bbox"])[: limit or None]
    print(f"[{rid}] {len(chunks)} chunks, {workers} workers", file=sys.stderr, flush=True)
    rows_all, spots_all, done, kept = [], [], 0, 0
    tasks = [(rid, i, c, str(state_pbf), str(base_dir / "chunks"), str(cal)) for i, c in enumerate(chunks)]
    with ProcessPoolExecutor(max_workers=workers) as ex:
        for fut in as_completed([ex.submit(process_chunk, t) for t in tasks]):
            r = fut.result()
            done += 1
            if r:
                rows_all += r["rows"]; spots_all += r["spots"]; kept += 1
            if done % 10 == 0 or done == len(tasks):
                print(f"[{rid}] {done}/{len(tasks)} chunks, {len(rows_all)} cells so far", file=sys.stderr, flush=True)

    tiles = group_into_tiles(rows_all, spots_all)
    out = WEB_DATA / "regions" / rid
    if out.exists():
        shutil.rmtree(out)
    for tid, t in tiles.items():
        write_json(out / f"{tid}.json", {"v": 1, "res": RES, "tile": tid, "cells": t["cells"], "spots": t["spots"]})
    update_catalogue(reg, sorted(tiles), len(rows_all))
    print(f"[{rid}] {len(rows_all)} cells in {len(tiles)} tiles ({kept} non-empty chunks)")


def update_catalogue(reg: dict, tile_ids: list[str], cells: int) -> None:
    path = WEB_DATA / "regions.json"
    cat = json.loads(path.read_text()) if path.exists() else {"v": 1, "tileRes": TILE_RES, "regions": []}
    cat["regions"] = [r for r in cat["regions"] if r["id"] != reg["id"]] + [{
        "id": reg["id"], "name": reg["name"], "bbox": reg["bbox"], "ncrbState": reg.get("ncrb_state"), "cells": cells, "tiles": tile_ids,
        "version": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")}]
    cat["regions"].sort(key=lambda r: r["id"])
    write_json(path, cat)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--region", required=True)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--limit", type=int, default=None, help="only the first N chunks (testing)")
    a = ap.parse_args()
    run_region(a.region, a.workers, a.limit)


if __name__ == "__main__":
    main()
