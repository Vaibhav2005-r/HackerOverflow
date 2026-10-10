"""Regenerates fixtures/tiny_osm.json (run once; output is committed)."""
import json, pathlib
LAT, LNG = 19.2000, 72.8500
def way(i, tags, pts): return {"type": "way", "id": i, "tags": tags, "geometry": [{"lat": a, "lon": b} for a, b in pts]}
osm = {
  "roads": [
    way(1, {"highway": "primary", "lit": "yes"}, [(LAT, LNG), (LAT, LNG + 0.003)]),            # ~315 m lit
    way(2, {"highway": "track", "lit": "no"}, [(LAT + .02, LNG + .02), (LAT + .02, LNG + .023)]),  # unlit track far away
    way(3, {"highway": "residential"}, [(LAT - .02, LNG), (LAT - .02, LNG + .002)]),           # untagged
    way(4, {"highway": "residential", "tunnel": "yes"}, [(LAT - .04, LNG), (LAT - .04, LNG + .002)]),
  ],
  "pois": [
    {"type": "node", "id": 10, "lat": LAT + .0005, "lon": LNG + .001, "tags": {"amenity": "police", "name": "Test PS"}},
    {"type": "node", "id": 11, "lat": LAT + .0003, "lon": LNG + .0012, "tags": {"amenity": "restaurant", "opening_hours": "Mo-Su 10:00-23:30"}},
    {"type": "node", "id": 12, "lat": LAT, "lon": LNG + .0015, "tags": {"shop": "convenience"}},
    {"type": "node", "id": 13, "lat": LAT + .0004, "lon": LNG + .0004, "tags": {"amenity": "fuel", "opening_hours": "24/7"}},
    {"type": "node", "id": 14, "lat": LAT + .0002, "lon": LNG + .0002, "tags": {"highway": "bus_stop"}},
    {"type": "node", "id": 15, "lat": LAT + .0006, "lon": LNG + .0006, "tags": {"railway": "station", "name": "Test Stn"}},
  ],
  "buildings": [{"type": "way", "id": 20 + i, "center": {"lat": LAT + .0003, "lon": LNG + .0005 + i * .00003}} for i in range(5)],
  "areas": [{"type": "way", "id": 30, "tags": {"landuse": "industrial"},
             "geometry": [{"lat": a, "lon": b} for a, b in
                          [(LAT + .015, LNG + .015), (LAT + .015, LNG + .03), (LAT + .03, LNG + .03), (LAT + .03, LNG + .015), (LAT + .015, LNG + .015)]]}],
}
pathlib.Path(__file__).parent.joinpath("fixtures/tiny_osm.json").write_text(json.dumps(osm, indent=1))
