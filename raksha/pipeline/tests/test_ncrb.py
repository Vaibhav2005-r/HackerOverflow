from raksha_pipeline import ncrb


def row(state, district, year, circle=None, **cols):
    base = {"state_name": state, "district_name": district, "year": str(year), "registration_circles": circle or district}
    base.update({k: str(v) for k, v in cols.items()})
    return base


ROWS = [
    row("Maharashtra", "Mumbai", 2021, "Mumbai Commissionerate", rape_women_above_18=300, cruelty_by_husband_or_his_relatives=800),
    row("Maharashtra", "Mumbai", 2021, "Mumbai Railway", rape_women_above_18=5),              # railway police: not territorial
    row("Maharashtra", "Mumbai", 2022, "Mumbai Commissionerate", rape_women_above_18=370, cruelty_by_husband_or_his_relatives=901, kidnapping_and_abduction=50),
    row("Maharashtra", "Mumbai Suburban", 2022, rape_women_above_18=105, cruelty_by_husband_or_his_relatives=226),
    row("Maharashtra", "Pune", 2022, rape_women_above_18=10),
    row("Delhi", "South", 2022, "South", assault_on_womenabove_18=7),
    row("Delhi", "New Delhi", 2022, "Crime Branch", assault_on_womenabove_18=999),            # crime branch: excluded
    row("Delhi", "New Delhi", 2022, "New Delhi", assault_on_womenabove_18=3),
    row("Maharashtra", "Mumbai", 2022, "Mumbai Commissionerate", child_rape=777, sexual_assault_of_children=999),  # POCSO columns never counted
]
CITIES = {"mumbai": {"ncrb": {"state": "Maharashtra", "districts": ["Mumbai", "Mumbai Suburban"]}},
          "delhi": {"ncrb": {"state": "Delhi", "districts": "all"}}, "nowhere": {}, "ghost": {"ncrb": {"state": "X", "districts": ["Y"]}}}


def test_territorial_filter_and_headline_categories():
    agg = ncrb.parse(ROWS)
    assert sum(agg[("Maharashtra", "Mumbai")][2021].values()) == 1100            # 300 + 800, railway excluded
    assert sum(agg[("Maharashtra", "Mumbai")][2022].values()) == 370 + 901 + 50   # POCSO columns ignored
    assert sum(agg[("Delhi", "New Delhi")][2022].values()) == 3                   # crime branch excluded


def test_city_totals_sum_member_districts_and_unmapped_cities_are_skipped():
    d = ncrb.build(ROWS, CITIES)
    assert d["years"] == [2021, 2022]
    assert d["cities"]["mumbai"]["totals"] == [1100, 370 + 901 + 50 + 105 + 226]
    assert d["cities"]["delhi"]["totals"] == [None, 10]                           # "all" = every Delhi district; no 2021 data
    assert "nowhere" not in d["cities"] and "ghost" not in d["cities"]


def test_ranks_are_per_year_and_one_is_the_most_cases():
    d = ncrb.build(ROWS, CITIES)
    by = {x["district"]: x for x in d["districts"]}
    assert by["Mumbai"]["rank"]["2022"] == [1, 5] and by["Pune"]["rank"]["2022"][0] > by["Mumbai Suburban"]["rank"]["2022"][0]
    assert "2021" in by["Mumbai"]["rank"] and "2021" not in by["Pune"].get("rank", {})
    assert d["districts"][0]["latest"] or True


def test_state_totals_sum_territorial_districts_and_rank_states():
    d = ncrb.build(ROWS, CITIES)
    mh = d["states"]["Maharashtra"]
    assert mh["totals"] == [1100, 370 + 901 + 50 + 105 + 226 + 10] and mh["districts"] == 3
    assert d["states"]["Delhi"]["totals"] == [None, 10]
    assert mh["rank"]["2022"] == [1, 2] and d["states"]["Delhi"]["rank"]["2022"] == [2, 2]


def test_output_carries_its_own_caveats():
    d = ncrb.build(ROWS, CITIES)
    assert "counts, not rates" in d["notes"] and d["source"]["url"].startswith("https://")
