import argparse
import hashlib
import json
import os
import re
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple

from datasets import load_dataset


DATASET_ID = "ManikaSaini/zomato-restaurant-recommendation"

DEFAULT_CACHE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "hf_cache"))


def _configure_hf_cache() -> None:
    """
    Ensure Hugging Face cache directories are writable inside the workspace.
    Some environments restrict writing to ~/.cache.
    """
    os.environ.setdefault("XDG_CACHE_HOME", DEFAULT_CACHE_DIR)
    os.environ.setdefault("HF_HOME", DEFAULT_CACHE_DIR)
    os.environ.setdefault("HF_DATASETS_CACHE", os.path.join(DEFAULT_CACHE_DIR, "datasets"))
    os.environ.setdefault("HF_HUB_CACHE", os.path.join(DEFAULT_CACHE_DIR, "hub"))
    os.environ.setdefault("HUGGINGFACE_HUB_CACHE", os.path.join(DEFAULT_CACHE_DIR, "hub"))


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _norm_space(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def _parse_float(v: Any) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        s = v.strip()
        if not s or s.lower() in {"new", "nan", "none", "-", "null"}:
            return None
        m = re.search(r"[-+]?\d*\.?\d+", s)
        if not m:
            return None
        try:
            return float(m.group(0))
        except ValueError:
            return None
    return None


def _parse_cost(v: Any) -> Optional[float]:
    # Keep it simple and numeric; currency inference can be added later.
    return _parse_float(v)


def _split_cuisines(v: Any) -> List[str]:
    if v is None:
        return []
    if isinstance(v, list):
        parts = v
    else:
        s = str(v)
        if not s.strip():
            return []
        # Common separators: comma, pipe, slash.
        parts = re.split(r"[,/|]+", s)
    out: List[str] = []
    for p in parts:
        t = _norm_space(str(p))
        if not t:
            continue
        out.append(t)
    # Dedupe preserving order
    seen = set()
    deduped: List[str] = []
    for c in out:
        key = c.casefold()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(c)
    return deduped


def _first_present(row: Dict[str, Any], keys: Iterable[str]) -> Any:
    for k in keys:
        if k in row and row[k] not in (None, ""):
            return row[k]
    return None


def _restaurant_id(row: Dict[str, Any]) -> str:
    # Stable hash from a subset of identifying fields + full row fallback.
    # This is intentionally conservative; Phase 1 focuses on repeatability.
    payload = {
        "name": _first_present(row, ["name", "restaurant_name", "Restaurant Name", "restaurant"]),
        "location": _first_present(row, ["location", "city", "City", "locality", "area"]),
        "address": _first_present(row, ["address", "Address"]),
        "cuisines": _first_present(row, ["cuisines", "Cuisines", "cuisine"]),
        "raw": row,
    }
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str).encode("utf-8")
    return hashlib.sha1(raw).hexdigest()


@dataclass
class CanonicalRestaurant:
    restaurant_id: str
    name: str
    city: Optional[str]
    area: Optional[str]
    cuisines: List[str]
    avg_cost_for_two: Optional[float]
    currency: Optional[str]
    rating: Optional[float]
    rating_count: Optional[int]
    source_row_json: str


def _canonicalize(row: Dict[str, Any]) -> Optional[CanonicalRestaurant]:
    name = _first_present(row, ["name", "restaurant_name", "Restaurant Name", "restaurant"])
    if not name:
        return None
    name_s = _norm_space(str(name))
    if not name_s:
        return None

    city = _first_present(row, ["city", "City", "location_city", "Location City"])
    location = _first_present(row, ["location", "Location", "locality", "Locality", "area", "Area"])

    # If dataset only has a single location string, store it as city when city is missing.
    city_s = _norm_space(str(city)) if city else None
    area_s = None
    if location:
        loc_s = _norm_space(str(location))
        if city_s is None:
            city_s = loc_s
        else:
            area_s = loc_s

    cuisines = _split_cuisines(_first_present(row, ["cuisines", "Cuisines", "cuisine", "Cuisine"]))

    rating = _parse_float(_first_present(row, ["rating", "Rating", "aggregate_rating", "Aggregate rating", "rate", "Rate"]))
    # Heuristic: some datasets use "votes" / "rating_count"
    rc = _first_present(row, ["rating_count", "votes", "Votes", "Rating count"])
    rating_count = None
    if rc is not None:
        try:
            rating_count = int(float(str(rc).strip()))
        except ValueError:
            rating_count = None

    avg_cost = _parse_cost(
        _first_present(
            row,
            [
                "avg_cost_for_two",
                "Average Cost for two",
                "average_cost_for_two",
                "cost_for_two",
                "Cost for two",
                "approx_cost(for two people)",
                "approx_cost_for_two",
                "cost",
                "Cost",
            ],
        )
    )
    currency = _first_present(row, ["currency", "Currency"])
    currency_s = _norm_space(str(currency)) if currency else None

    rid = _restaurant_id(row)
    source_row_json = json.dumps(row, ensure_ascii=False, default=str)

    return CanonicalRestaurant(
        restaurant_id=rid,
        name=name_s,
        city=city_s,
        area=area_s,
        cuisines=cuisines,
        avg_cost_for_two=avg_cost,
        currency=currency_s,
        rating=rating,
        rating_count=rating_count,
        source_row_json=source_row_json,
    )


def _ensure_schema(conn: sqlite3.Connection) -> None:
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS ingestion_runs (
          run_id TEXT PRIMARY KEY,
          dataset_id TEXT NOT NULL,
          dataset_revision TEXT,
          split_name TEXT NOT NULL,
          started_at TEXT NOT NULL,
          finished_at TEXT,
          row_count INTEGER NOT NULL DEFAULT 0
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS restaurants (
          restaurant_id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          city TEXT,
          area TEXT,
          cuisines_json TEXT NOT NULL,
          avg_cost_for_two REAL,
          currency TEXT,
          rating REAL,
          rating_count INTEGER,
          source_row_json TEXT NOT NULL,
          ingested_at TEXT NOT NULL
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_restaurants_city ON restaurants(city);")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_restaurants_rating ON restaurants(rating);")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_restaurants_cost ON restaurants(avg_cost_for_two);")


def _upsert_restaurant(conn: sqlite3.Connection, r: CanonicalRestaurant, ingested_at: str) -> None:
    conn.execute(
        """
        INSERT INTO restaurants (
          restaurant_id, name, city, area, cuisines_json, avg_cost_for_two, currency,
          rating, rating_count, source_row_json, ingested_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(restaurant_id) DO UPDATE SET
          name=excluded.name,
          city=excluded.city,
          area=excluded.area,
          cuisines_json=excluded.cuisines_json,
          avg_cost_for_two=excluded.avg_cost_for_two,
          currency=excluded.currency,
          rating=excluded.rating,
          rating_count=excluded.rating_count,
          source_row_json=excluded.source_row_json,
          ingested_at=excluded.ingested_at
        """,
        (
            r.restaurant_id,
            r.name,
            r.city,
            r.area,
            json.dumps(r.cuisines, ensure_ascii=False),
            r.avg_cost_for_two,
            r.currency,
            r.rating,
            r.rating_count,
            r.source_row_json,
            ingested_at,
        ),
    )


def _quality_report(conn: sqlite3.Connection) -> Dict[str, Any]:
    def scalar(q: str, args: Tuple[Any, ...] = ()) -> Any:
        cur = conn.execute(q, args)
        row = cur.fetchone()
        return row[0] if row else None

    total = scalar("SELECT COUNT(*) FROM restaurants") or 0
    if total == 0:
        return {"total_restaurants": 0, "notes": ["No restaurants ingested."]}

    null_city = scalar("SELECT COUNT(*) FROM restaurants WHERE city IS NULL OR city = ''") or 0
    null_rating = scalar("SELECT COUNT(*) FROM restaurants WHERE rating IS NULL") or 0
    null_cost = scalar("SELECT COUNT(*) FROM restaurants WHERE avg_cost_for_two IS NULL") or 0
    null_cuisines = scalar("SELECT COUNT(*) FROM restaurants WHERE cuisines_json = '[]'") or 0

    top_cities = [
        {"city": r[0], "count": r[1]}
        for r in conn.execute(
            """
            SELECT city, COUNT(*) AS c
            FROM restaurants
            WHERE city IS NOT NULL AND city != ''
            GROUP BY city
            ORDER BY c DESC
            LIMIT 20
            """
        ).fetchall()
    ]

    # Top cuisines: compute in Python (SQLite JSON1 may not be enabled everywhere).
    cuisine_counts: Dict[str, int] = {}
    for (cj,) in conn.execute("SELECT cuisines_json FROM restaurants").fetchall():
        try:
            cuisines = json.loads(cj) if cj else []
        except json.JSONDecodeError:
            cuisines = []
        for c in cuisines:
            k = str(c).strip()
            if not k:
                continue
            cuisine_counts[k] = cuisine_counts.get(k, 0) + 1
    top_cuisines = [
        {"cuisine": k, "count": v}
        for k, v in sorted(cuisine_counts.items(), key=lambda kv: kv[1], reverse=True)[:30]
    ]

    return {
        "total_restaurants": total,
        "null_rates": {
            "city": null_city / total,
            "rating": null_rating / total,
            "avg_cost_for_two": null_cost / total,
            "cuisines": null_cuisines / total,
        },
        "top_cities": top_cities,
        "top_cuisines": top_cuisines,
    }


def ingest(db_path: str, split: str, dataset_revision: Optional[str]) -> Dict[str, Any]:
    _configure_hf_cache()
    os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)
    conn = sqlite3.connect(db_path)
    try:
        _ensure_schema(conn)

        run_id = hashlib.sha1(f"{DATASET_ID}:{dataset_revision}:{split}:{_utc_now_iso()}".encode("utf-8")).hexdigest()
        started_at = _utc_now_iso()
        conn.execute(
            """
            INSERT INTO ingestion_runs (run_id, dataset_id, dataset_revision, split_name, started_at, row_count)
            VALUES (?, ?, ?, ?, ?, 0)
            """,
            (run_id, DATASET_ID, dataset_revision, split, started_at),
        )
        conn.commit()

        ds = load_dataset(DATASET_ID, revision=dataset_revision, split=split)
        ingested_at = _utc_now_iso()

        count = 0
        with conn:
            for item in ds:
                r = _canonicalize(dict(item))
                if r is None:
                    continue
                _upsert_restaurant(conn, r, ingested_at=ingested_at)
                count += 1

        finished_at = _utc_now_iso()
        conn.execute(
            "UPDATE ingestion_runs SET finished_at=?, row_count=? WHERE run_id=?",
            (finished_at, count, run_id),
        )
        conn.commit()

        report = _quality_report(conn)
        return {
            "run_id": run_id,
            "dataset_id": DATASET_ID,
            "dataset_revision": dataset_revision,
            "split": split,
            "started_at": started_at,
            "finished_at": finished_at,
            "ingested_count": count,
            "quality_report": report,
        }
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest the Zomato HF dataset into canonical SQLite.")
    parser.add_argument("--db", default="data/restaurants.sqlite", help="SQLite database path")
    parser.add_argument("--split", default="train", help="HF dataset split (e.g., train)")
    parser.add_argument(
        "--revision",
        default=None,
        help="Optional Hugging Face dataset revision (commit hash/tag) to pin reproducibility.",
    )
    parser.add_argument(
        "--report-out",
        default="data/quality_report.json",
        help="Path to write a JSON quality report",
    )
    args = parser.parse_args()

    result = ingest(db_path=args.db, split=args.split, dataset_revision=args.revision)
    os.makedirs(os.path.dirname(args.report_out) or ".", exist_ok=True)
    with open(args.report_out, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(json.dumps({"status": "ok", "db": args.db, "report": args.report_out, "ingested": result["ingested_count"]}))


if __name__ == "__main__":
    main()

