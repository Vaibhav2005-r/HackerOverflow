from __future__ import annotations
from .features import night_weight

LABEL = {"police": "Police station", "hospital": "Hospital", "fuel": "Fuel station", "station": "Station"}


def extract(pois: list[dict]) -> list[dict]:
    out = []
    for p in pois:
        k = p["kind"]
        if k not in LABEL:
            continue
        t = p["tags"]
        item = {"kind": k, "name": t.get("name") or LABEL[k], "lat": round(p["lat"], 6),
                "lng": round(p["lng"], 6), "h3": p["h3"]}
        if k == "fuel":
            item["24x7"] = "24/7" in (t.get("opening_hours") or "")
        out.append(item)
    return out
