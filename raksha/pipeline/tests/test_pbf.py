import json
import shutil
import subprocess
import pathlib
import pytest
from raksha_pipeline import fetch_pbf

FIX = pathlib.Path(__file__).parent / "fixtures" / "tiny.osm"


def lines(*feats):
    return ["\x1e" + json.dumps(f) + "\n" for f in feats]   # osmium prefixes each record with RS


def test_features_tolerates_record_separators_and_truncated_lines():
    got = list(fetch_pbf.features(lines({"a": 1}) + ['{"broken": '] + lines({"b": 2})))
    assert got == [{"a": 1}, {"b": 2}]


def test_roads_keep_tags_and_geometry_order():
    f = {"id": "w1", "properties": {"highway": "primary", "lit": "yes"}, "geometry": {"type": "LineString", "coordinates": [[72.85, 19.2], [72.86, 19.2]]}}
    r = fetch_pbf.roads([f, {"properties": {}, "geometry": {"type": "Point", "coordinates": [0, 0]}}])
    assert len(r) == 1 and r[0]["tags"]["lit"] == "yes" and r[0]["geometry"][0] == {"lat": 19.2, "lon": 72.85}


def test_pois_from_points_and_polygons_use_lat_lon_centres():
    pt = {"properties": {"amenity": "police"}, "geometry": {"type": "Point", "coordinates": [72.85, 19.2]}}
    poly = {"properties": {"shop": "mall"}, "geometry": {"type": "Polygon", "coordinates": [[[72.0, 19.0], [72.0, 19.2], [72.2, 19.2], [72.2, 19.0], [72.0, 19.0]]]}}
    a, b = fetch_pbf.pois([pt, poly])
    assert (a["lat"], a["lon"]) == (19.2, 72.85)
    assert b["lat"] == pytest.approx(19.1) and b["lon"] == pytest.approx(72.1)      # closing vertex not double counted


def test_multipolygon_areas_become_one_way_per_part_and_tiny_rings_are_dropped():
    ring = [[72.0, 19.0], [72.0, 19.1], [72.1, 19.1], [72.0, 19.0]]
    mp = {"id": "r9", "properties": {"landuse": "industrial"}, "geometry": {"type": "MultiPolygon", "coordinates": [[ring], [[[0, 0], [1, 1], [0, 0]]]]}}
    out = fetch_pbf.areas([mp])
    assert len(out) == 1 and out[0]["tags"]["landuse"] == "industrial" and len(out[0]["geometry"]) == 4


def test_closed_ways_are_not_double_counted():
    ring = [[72.0, 19.0], [72.0, 19.2], [72.2, 19.2], [72.2, 19.0], [72.0, 19.0]]
    as_line = {"id": "w1", "properties": {"building": "yes"}, "geometry": {"type": "LineString", "coordinates": ring}}
    as_area = {"id": "a2", "properties": {"building": "yes"}, "geometry": {"type": "Polygon", "coordinates": [ring]}}
    assert len(fetch_pbf.buildings([as_line, as_area])) == 1
    assert len(fetch_pbf.pois([{**as_line, "properties": {"shop": "x"}}, {**as_area, "properties": {"shop": "x"}}])) == 1


def test_buildings_become_centroids():
    sq = {"properties": {"building": "yes"}, "geometry": {"type": "Polygon", "coordinates": [[[72.0, 19.0], [72.0, 19.2], [72.2, 19.2], [72.2, 19.0], [72.0, 19.0]]]}}
    assert fetch_pbf.buildings([sq])[0]["center"] == pytest.approx({"lat": 19.1, "lon": 72.1})


@pytest.mark.skipif(shutil.which("osmium") is None, reason="osmium-tool not installed")
def test_end_to_end_with_real_osmium(tmp_path, monkeypatch):
    """XML → PBF → bbox extract → tag filters → GeoJSON → internal format: exercises the real toolchain on a tiny map."""
    pbf_dir = tmp_path / "pbf"; pbf_dir.mkdir()
    subprocess.run(["osmium", "cat", str(FIX), "-o", str(pbf_dir / "zone.osm.pbf")], check=True, stdout=subprocess.DEVNULL)
    monkeypatch.setattr(fetch_pbf, "RAW_DIR", tmp_path); monkeypatch.setattr(fetch_pbf, "PBF_DIR", pbf_dir)
    city = {"id": "t", "pbf": "zone", "bbox": [19.19, 72.84, 19.23, 72.88]}      # excludes the far-away node 13
    osm = fetch_pbf.fetch(city)
    assert [r["tags"]["highway"] for r in osm["roads"]] == ["primary"] or {r["tags"]["highway"] for r in osm["roads"]} >= {"primary"}
    assert any(p["tags"].get("amenity") == "police" and p["lat"] == pytest.approx(19.2005) for p in osm["pois"])
    assert len(osm["buildings"]) == 1 and osm["buildings"][0]["center"]["lat"] == pytest.approx(19.20115, abs=1e-4)
    assert len(osm["areas"]) == 1 and osm["areas"][0]["tags"]["landuse"] == "industrial"
    # and the existing feature extraction runs on it unchanged
    import h3
    from raksha_pipeline.features import compute_features
    cover = {h3.latlng_to_cell(19.2, 72.851, 9)}
    feats, _ = compute_features(osm, cover | set(h3.grid_disk(next(iter(cover)), 2)), 9, (19.2, 72.85))
    assert feats and max(f["light"] for f in feats) > 0.9
