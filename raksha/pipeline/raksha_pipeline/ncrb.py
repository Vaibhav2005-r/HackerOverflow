"""NCRB *Crime in India* — district-wise crimes against women (registered cases), 2017 onwards.

Source: India Data Portal, resource "Districtwise Crime Against Women 2017 onwards" (CSV; original: NCRB Crime in India).
Output: apps/web/public/data/ncrb/districts.json.

What the number means (and does not):
- it counts *registered cases* in selected categories; higher can mean better access to policing, not more crime;
- these are COUNTS, not rates (the portal file carries no population), so large districts rank high by size alone;
- it is district-level context. It is NOT used in the street-level safety score.
"""
from __future__ import annotations
import csv
import json
import re
from collections import defaultdict
from pathlib import Path
from .io import ROOT, RAW_DIR, WEB_DATA, load_city, load_all, write_json

SOURCE = {
    "name": "NCRB, Crime in India — via India Data Portal",
    "url": "https://ckandev.indiadataportal.com/dataset/crime-statistics/resource/c8d3ea7e-4855-45f3-9c26-557419e93b6a",
}

# Headline = main women-centric IPC / special-law heads in the file. POCSO (children) and trafficking/ITP columns are left out so
# nothing is double counted; "kidnapping_and_abduction" is its own head in this file (it is not the sum of its sub-columns).
CATEGORIES = {
    "rape": ["rape_women_above_18", "rape_girls_below_18", "murder_with_rape_gang_rape"],
    "attempt_to_rape": ["attempt_to_commit_rape_above_18", "attempt_to_commit_rape_girls_below_18"],
    "kidnapping": ["kidnapping_and_abduction"],
    "assault": ["assault_on_womenabove_18", "assault_on_women_below_18"],
    "insult_modesty": ["insult_to_the_modesty_of_women_above_18", "insult_to_the_modesty_of_women_below_18"],
    "cruelty_by_husband": ["cruelty_by_husband_or_his_relatives"],
    "dowry": ["dowry_deaths", "dowry_prohibition"],
    "domestic_violence_act": ["protection_of_women_from_domestic_violence"],
    "other": ["abetment_to_suicide_of_women", "miscarriage", "acid_attack", "attempt_to_acid_attack"],
}

# registration units that are not territorial districts (railway police, CID, crime branch, cyber cells, airports …)
NON_TERRITORIAL = re.compile(r"\b(grp|rly|railway|cid|crime branch|cyber|economic|eow|airport|metro|stf|special|women|anti|vigilance|bureau|task force|sit|nia)\b", re.I)


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", (s or "").lower())).strip()


def _n(v: str | None) -> int:
    try:
        return int(float(v)) if v not in (None, "") else 0
    except ValueError:
        return 0


def parse(rows: list[dict]) -> dict:
    """rows → {(state, district): {year: {category: n}}}, territorial units only."""
    agg: dict[tuple[str, str], dict[int, dict[str, int]]] = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    for r in rows:
        if NON_TERRITORIAL.search(r.get("registration_circles") or ""):
            continue
        key = (r["state_name"].strip(), r["district_name"].strip())
        year = int(r["year"])
        for cat, cols in CATEGORIES.items():
            agg[key][year][cat] += sum(_n(r.get(c)) for c in cols)
    return agg


def build(rows: list[dict], cities: dict[str, dict]) -> dict:
    agg = parse(rows)
    years = sorted({y for d in agg.values() for y in d})
    districts = []
    for (state, name), by_year in sorted(agg.items()):
        totals = [sum(by_year[y].values()) if y in by_year else None for y in years]
        latest_y = max((y for y in by_year), default=None)
        top = sorted(by_year[latest_y].items(), key=lambda kv: -kv[1])[:6] if latest_y else []
        districts.append({"key": f"{norm(state)}/{norm(name)}", "state": state, "district": name, "totals": totals,
                          "latest": {k: v for k, v in top if v}})
    # ranks among districts with data that year (1 = most registered cases)
    for i, y in enumerate(years):
        have = sorted((d for d in districts if d["totals"][i] is not None), key=lambda d: -d["totals"][i])
        for rank, d in enumerate(have, 1):
            d.setdefault("rank", {})[str(y)] = [rank, len(have)]
    by_key = {d["key"]: d for d in districts}

    out_cities = {}
    for cid, c in cities.items():
        spec = c.get("ncrb")
        if not spec:
            continue
        st = norm(spec["state"])
        want = [norm(x) for x in spec["districts"]] if spec["districts"] != "all" else None
        members = [d for d in districts if norm(d["state"]) == st and (want is None or norm(d["district"]) in want)]
        if not members:
            continue
        totals = [sum(d["totals"][i] or 0 for d in members) if any(d["totals"][i] is not None for d in members) else None for i in range(len(years))]
        out_cities[cid] = {"districts": [d["key"] for d in members], "totals": totals}
    # state totals (sum of its territorial districts) with a per-year rank among states — context for state-wide coverage
    states: dict[str, dict] = {}
    for d in districts:
        st = states.setdefault(d["state"], {"totals": [None] * len(years), "districts": 0})
        st["districts"] += 1
        for i, v in enumerate(d["totals"]):
            if v is not None:
                st["totals"][i] = (st["totals"][i] or 0) + v
    for i, y in enumerate(years):
        have = sorted((s for s in states.values() if s["totals"][i] is not None), key=lambda s: -s["totals"][i])
        for rank, s in enumerate(have, 1):
            s.setdefault("rank", {})[str(y)] = [rank, len(have)]
    return {"v": 1, "source": SOURCE, "years": years, "categories": list(CATEGORIES), "districts": districts, "cities": out_cities, "states": states,
            "notes": "Registered cases in selected categories; counts, not rates; district level; not used in the street-level score."}


def run(csv_path: Path | None = None) -> None:
    path = csv_path or RAW_DIR / "ncrb" / "cases.csv"
    rows = list(csv.DictReader(path.open(encoding="utf-8-sig")))
    cities = {cid: load_city(cid) for cid in load_all()}
    data = build(rows, cities)
    write_json(WEB_DATA / "ncrb" / "districts.json", data)
    print(f"ncrb: {len(data['districts'])} districts, years {data['years'][0]}–{data['years'][-1]}, cities {sorted(data['cities'])}")


if __name__ == "__main__":
    run()
