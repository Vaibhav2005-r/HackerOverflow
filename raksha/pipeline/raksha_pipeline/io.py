from __future__ import annotations
import json
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[2]          # raksha/
RAW_DIR = ROOT / "data" / "raw"
WEB_DATA = ROOT / "apps" / "web" / "public" / "data"
CONFIG = Path(__file__).resolve().parents[1] / "config" / "cities.yaml"


def load_city(city: str) -> dict:
    cities = yaml.safe_load(CONFIG.read_text())
    if city not in cities:
        raise SystemExit(f"unknown city {city!r}; have {sorted(cities)}")
    return {"id": city, **cities[city]}


def load_all() -> list[str]:
    return list(yaml.safe_load(CONFIG.read_text()))


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":")))
