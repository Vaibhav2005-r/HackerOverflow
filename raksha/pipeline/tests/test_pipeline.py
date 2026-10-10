import json
import pathlib
import h3
import pytest
from raksha_pipeline.features import compute_features, is_late, light_value, night_weight, poi_kind
from raksha_pipeline.safe_spots import extract

LAT, LNG = 19.2000, 72.8500
OSM = json.loads((pathlib.Path(__file__).parent / "fixtures/tiny_osm.json").read_text())
RES = 9


def c(dlat, dlng): return h3.latlng_to_cell(LAT + dlat, LNG + dlng, RES)


@pytest.fixture(scope="module")
def feats():
    cover = {c(0, 0), c(0, .0015), c(.02, .02), c(-.02, 0), c(-.04, 0), c(.022, .022), c(.5, .5)}
    cover |= {n for k in list(cover) for n in h3.grid_disk(k, 1)}
    f, pois = compute_features(OSM, cover, RES, (LAT, LNG))
    return {x["h3"]: x for x in f}, pois


def test_light_priors_and_tags():
    assert light_value({"highway": "primary", "lit": "yes"}) == (1.0, True)
    assert light_value({"highway": "primary", "lit": "no"}) == (0.0, True)
    assert light_value({"highway": "residential"}) == (.45, False)
    assert light_value({"highway": "residential", "tunnel": "yes"})[0] == pytest.approx(.27)
    assert light_value({"highway": "primary", "tunnel": "yes", "lit": "yes"})[0] == 1.0  # explicit lit wins


def test_opening_hours_parsing():
    assert is_late("Mo-Su 10:00-23:30") and is_late("10:00-02:00")
    assert not is_late("09:00-21:00") and not is_late(None)
    assert night_weight("food", {"opening_hours": "24/7"}) == 1.0
    assert night_weight("food", {}) == .2
    assert night_weight("fuel", {}) == .5
    assert night_weight("shop", {"opening_hours": "09:00-21:00"}) == 0.0
    assert night_weight("police", {}) == 1.0


def test_poi_kind():
    assert poi_kind({"amenity": "toilets"}) is None
    assert poi_kind({"highway": "bus_stop"}) == "busstop"
    assert poi_kind({"railway": "halt"}) == "station"


def test_lit_primary_road_features(feats):
    f, _ = feats
    cell = f[c(0, 0)]
    assert cell["light"] > .95 and cell["light_tagged_frac"] > .95 and cell["road"] == pytest.approx(1.0, abs=.01)
    assert cell["help"] > .5            # police ~280 m from cell centre: exp(-d/600) ≈ .63
    assert cell["transit"] > .5
    assert cell["poi_k1"] >= 1


def test_unlit_track_inside_industrial_is_isolated(feats):
    f, _ = feats
    cell = f[c(.02, .02)]
    assert cell["light"] == 0.0 and cell["iso_night"] == 1.0 and cell["iso_day"] == 1.0
    assert cell["help"] < .01 and cell["act_night"] == 0.0


def test_neighbour_weighting_gives_activity_to_adjacent_cells(feats):
    f, pois = feats
    poi_cells = {p["h3"] for p in pois}
    # a cell that has no POI itself but touches a POI cell still sees activity
    adj = {n for p in poi_cells for n in h3.grid_ring(p, 1)} - poi_cells
    adj &= set(f)
    if adj:
        assert any(f[a]["act_night"] > 0 for a in adj)


def test_untagged_lighting_is_prior_with_zero_tag_fraction(feats):
    f, _ = feats
    cell = f[c(-.02, 0)]
    assert cell["light"] == pytest.approx(.45, abs=.01) and cell["light_tagged_frac"] == 0.0
    assert f[c(-.04, 0)]["light"] == pytest.approx(.27, abs=.01)


def test_empty_cells_are_dropped(feats):
    f, _ = feats
    assert c(.5, .5) not in f


def test_safe_spots(feats):
    _, pois = feats
    spots = extract(pois)
    kinds = {s["kind"] for s in spots}
    assert kinds == {"police", "fuel", "station"}
    fuel = next(s for s in spots if s["kind"] == "fuel")
    assert fuel["24x7"] is True and next(s for s in spots if s["kind"] == "police")["name"] == "Test PS"
