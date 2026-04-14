import json
import os
import sqlite3
from dataclasses import dataclass
from difflib import get_close_matches
from typing import Any, Dict, List, Optional, Tuple

from backend.models import BudgetBucket, Preferences, Recommendation, Relaxation


DEFAULT_DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "restaurants.sqlite"))


def _cf(s: str) -> str:
    return " ".join(s.strip().split()).casefold()


def _parse_cuisines(cuisines_json: str) -> List[str]:
    if not cuisines_json:
        return []
    try:
        v = json.loads(cuisines_json)
    except json.JSONDecodeError:
        return []
    if not isinstance(v, list):
        return []
    out: List[str] = []
    for item in v:
        t = " ".join(str(item).strip().split())
        if t:
            out.append(t)
    return out


def _budget_range(bucket: BudgetBucket, widen_steps: int = 0) -> Tuple[Optional[float], Optional[float]]:
    """
    Returns (min_cost, max_cost) for avg_cost_for_two.
    widen_steps expands the range outward to reduce empty results.
    """
    ranges: Dict[BudgetBucket, Tuple[Optional[float], Optional[float]]] = {
        BudgetBucket.low: (0.0, 500.0),
        BudgetBucket.medium: (500.0, 1500.0),
        BudgetBucket.high: (1500.0, None),
    }
    lo, hi = ranges[bucket]
    if widen_steps <= 0:
        return lo, hi

    # Expand by 20% per step relative to the bucket width.
    pct = 0.2 * widen_steps
    width = None
    if lo is not None and hi is not None:
        width = max(1.0, hi - lo)
    elif lo is not None and hi is None:
        width = max(1.0, lo)
    elif lo is None and hi is not None:
        width = max(1.0, hi)

    expand = (width or 500.0) * pct
    if lo is not None:
        lo = max(0.0, lo - expand)
    if hi is not None:
        hi = hi + expand
    return lo, hi


def _rating_threshold(minimum_rating: float, relax_steps: int = 0) -> float:
    # Relax in 0.5 steps down to 0.0
    return max(0.0, minimum_rating - 0.5 * relax_steps)


def _normalize_location(user_location: str, known_locations: List[str]) -> str:
    """
    Normalizes user location using:
    - alias map (small, extendable)
    - exact case-insensitive match to known locations
    - close-match fallback
    """
    raw = " ".join(user_location.strip().split())
    if not raw:
        return raw
    aliases = {
        "bengaluru": "Bangalore",
        "bangalore": "Bangalore",
        "delhi ncr": "Delhi",
        "new delhi": "Delhi",
    }
    key = raw.casefold()
    if key in aliases:
        raw = aliases[key]

    if not known_locations:
        return raw

    cf_map: Dict[str, str] = {loc.casefold(): loc for loc in known_locations if loc}
    if raw.casefold() in cf_map:
        return cf_map[raw.casefold()]

    # Close match over casefolded set.
    candidates = list(cf_map.keys())
    best = get_close_matches(raw.casefold(), candidates, n=1, cutoff=0.8)
    if best:
        return cf_map[best[0]]
    return raw


def _normalize_cuisine(user_cuisine: str) -> str:
    raw = " ".join(user_cuisine.strip().split())
    if not raw:
        return raw
    synonyms = {
        "bbq": "Barbecue",
        "southindian": "South Indian",
        "northindian": "North Indian",
        "fastfood": "Fast Food",
    }
    key = raw.replace(" ", "").casefold()
    return synonyms.get(key, raw)


@dataclass
class _Row:
    restaurant_id: str
    name: str
    city: Optional[str]
    area: Optional[str]
    cuisines_json: str
    avg_cost_for_two: Optional[float]
    currency: Optional[str]
    rating: Optional[float]
    rating_count: Optional[int]


def _connect(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def _db_exists(db_path: str) -> bool:
    return os.path.exists(db_path) and os.path.getsize(db_path) > 0


def _known_locations(conn: sqlite3.Connection, limit: int = 2000) -> List[str]:
    rows = conn.execute(
        """
        SELECT city, COUNT(*) AS c
        FROM restaurants
        WHERE city IS NOT NULL AND city != ''
        GROUP BY city
        ORDER BY c DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return [r["city"] for r in rows if r["city"]]


def _query_candidates(
    conn: sqlite3.Connection,
    location: str,
    min_rating: float,
    include_unrated: bool,
    cost_range: Tuple[Optional[float], Optional[float]],
    limit: int,
) -> List[_Row]:
    lo, hi = cost_range

    where: List[str] = []
    args: List[Any] = []

    if location and location.casefold() != "bangalore":
        where.append("city = ?")
        args.append(location)

    if include_unrated:
        where.append("(rating IS NULL OR rating >= ?)")
        args.append(min_rating)
    else:
        where.append("rating IS NOT NULL AND rating >= ?")
        args.append(min_rating)

    if lo is not None:
        where.append("(avg_cost_for_two IS NOT NULL AND avg_cost_for_two >= ?)")
        args.append(lo)
    if hi is not None:
        where.append("(avg_cost_for_two IS NOT NULL AND avg_cost_for_two <= ?)")
        args.append(hi)

    sql = f"""
      SELECT restaurant_id, name, city, area, cuisines_json, avg_cost_for_two, currency, rating, rating_count
      FROM restaurants
      WHERE {' AND '.join(where)}
      LIMIT ?
    """
    args.append(limit)
    rows = conn.execute(sql, tuple(args)).fetchall()
    out: List[_Row] = []
    for r in rows:
        out.append(
            _Row(
                restaurant_id=r["restaurant_id"],
                name=r["name"],
                city=r["city"],
                area=r["area"],
                cuisines_json=r["cuisines_json"],
                avg_cost_for_two=r["avg_cost_for_two"],
                currency=r["currency"],
                rating=r["rating"],
                rating_count=r["rating_count"],
            )
        )
    return out


def _cuisine_overlap(candidate_cuisines: List[str], desired: str) -> bool:
    if not desired:
        return True
    desired_cf = _cf(desired)
    for c in candidate_cuisines:
        if _cf(c) == desired_cf:
            return True
    # Simple containment for variants (e.g., "North Indian" vs "Indian, North")
    for c in candidate_cuisines:
        if desired_cf in _cf(c) or _cf(c) in desired_cf:
            return True
    return False


def _score(row: _Row, desired_budget: BudgetBucket) -> float:
    """
    Baseline scoring:
    - rating (higher better)
    - rating_count (higher better, small weight)
    - cost proximity to bucket midpoint (closer better)
    """
    rating = float(row.rating or 0.0)
    votes = float(row.rating_count or 0.0)
    lo, hi = _budget_range(desired_budget, widen_steps=0)
    midpoint = None
    if lo is not None and hi is not None:
        midpoint = (lo + hi) / 2.0
    elif lo is not None and hi is None:
        midpoint = lo * 1.25
    elif lo is None and hi is not None:
        midpoint = hi * 0.75

    cost_penalty = 0.0
    if midpoint is not None and row.avg_cost_for_two is not None:
        cost_penalty = abs(float(row.avg_cost_for_two) - midpoint) / max(1.0, midpoint)

    return (rating * 10.0) + (votes ** 0.5) - (cost_penalty * 2.0)


def recommend_phase2(
    prefs: Preferences,
    db_path: str = DEFAULT_DB_PATH,
    candidate_limit: int = 2000,
) -> Tuple[List[Recommendation], List[Relaxation], List[str], str]:
    """
    Returns: (recommendations, relaxations_applied, notes, normalized_location_used)
    """
    if not _db_exists(db_path):
        notes = [f"Phase 2 DB not found at {db_path}. Run Phase 1 ingestion first."]
        return [], [], notes, prefs.location

    with _connect(db_path) as conn:
        known = _known_locations(conn)
        location = _normalize_location(prefs.location, known_locations=known)
        cuisine = _normalize_cuisine(prefs.cuisine)

        relaxations: List[Relaxation] = []
        notes: List[str] = []

        # Relaxation strategy (in order):
        # 1) widen budget slightly (0..2 steps)
        # 2) relax cuisine matching (drop cuisine constraint)
        # 3) step down rating threshold (0..6 steps => 3.0 points)
        widen_steps_options = [0, 1, 2]
        cuisine_relax_options = [False, True]
        rating_relax_steps_options = list(range(0, 7))

        for widen_steps in widen_steps_options:
            for relax_cuisine in cuisine_relax_options:
                for rating_relax_steps in rating_relax_steps_options:
                    min_rating = _rating_threshold(prefs.minimum_rating, relax_steps=rating_relax_steps)
                    cost_range = _budget_range(prefs.budget, widen_steps=widen_steps)

                    candidates = _query_candidates(
                        conn=conn,
                        location=location,
                        min_rating=min_rating,
                        include_unrated=prefs.include_unrated,
                        cost_range=cost_range,
                        limit=candidate_limit,
                    )

                    # Cuisine filtering in Python for portability.
                    filtered: List[Tuple[_Row, List[str]]] = []
                    for row in candidates:
                        cuisines_list = _parse_cuisines(row.cuisines_json)
                        if relax_cuisine or _cuisine_overlap(cuisines_list, cuisine):
                            filtered.append((row, cuisines_list))

                    if not filtered:
                        continue

                    # Compute relaxations_applied for the first successful strategy.
                    if widen_steps > 0:
                        prev = _budget_range(prefs.budget, widen_steps=0)
                        new = cost_range
                        relaxations.append(
                            Relaxation(
                                kind="budget",
                                reason="No results under strict budget bucket; widened acceptable cost range.",
                                previous_value={"min": prev[0], "max": prev[1]},
                                new_value={"min": new[0], "max": new[1]},
                            )
                        )
                    if relax_cuisine:
                        relaxations.append(
                            Relaxation(
                                kind="cuisine",
                                reason="No results for requested cuisine; relaxed cuisine constraint.",
                                previous_value=cuisine,
                                new_value=None,
                            )
                        )
                    if rating_relax_steps > 0:
                        relaxations.append(
                            Relaxation(
                                kind="rating",
                                reason="No results at requested minimum rating; lowered the threshold.",
                                previous_value=prefs.minimum_rating,
                                new_value=min_rating,
                            )
                        )

                    # Rank and return top N.
                    ranked = sorted(
                        filtered,
                        key=lambda t: _score(t[0], desired_budget=prefs.budget),
                        reverse=True,
                    )
                    top = ranked[: prefs.top_n]

                    recos: List[Recommendation] = []
                    for row, cuisines_list in top:
                        why_parts: List[str] = []
                        why_parts.append(f"Matches location: {location}.")
                        if not relax_cuisine and cuisine:
                            why_parts.append(f"Includes cuisine: {cuisine}.")
                        if row.rating is not None:
                            why_parts.append(f"Rating: {row.rating:.1f}.")
                        if row.avg_cost_for_two is not None:
                            why_parts.append(f"Estimated cost for two: {int(row.avg_cost_for_two)}.")

                        recos.append(
                            Recommendation(
                                restaurant_id=row.restaurant_id,
                                name=row.name,
                                location=row.city or location,
                                cuisines=cuisines_list,
                                rating=row.rating,
                                estimated_cost=row.avg_cost_for_two,
                                currency=row.currency,
                                why=" ".join(why_parts),
                            )
                        )

                    if location.casefold() != prefs.location.strip().casefold():
                        notes.append(f"Normalized location input '{prefs.location}' to '{location}'.")
                    if cuisine.casefold() != prefs.cuisine.strip().casefold():
                        notes.append(f"Normalized cuisine input '{prefs.cuisine}' to '{cuisine}'.")
                    notes.append("Phase 2 is deterministic; Groq LLM is integrated in later phases for explanation refinement.")
                    return recos, relaxations, notes, location

        # Nothing found at all.
        notes.append("No results found even after applying Phase 2 relaxations.")
        return [], [], notes, location


def metadata_from_db(db_path: str = DEFAULT_DB_PATH, limit: int = 200) -> Dict[str, Any]:
    if not _db_exists(db_path):
        return {
            "supported_budget_buckets": [b.value for b in BudgetBucket],
            "locations": [],
            "cuisines": [],
            "notes": [f"DB not found at {db_path}. Run Phase 1 ingestion first."],
        }

    with _connect(db_path) as conn:
        loc_rows = conn.execute(
            """
            SELECT city, COUNT(*) AS c
            FROM restaurants
            WHERE city IS NOT NULL AND city != ''
            GROUP BY city
            ORDER BY c DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        locations = [r["city"] for r in loc_rows if r["city"]]

        cuisine_counts: Dict[str, int] = {}
        for (cj,) in conn.execute("SELECT cuisines_json FROM restaurants").fetchall():
            for c in _parse_cuisines(cj):
                cuisine_counts[c] = cuisine_counts.get(c, 0) + 1
        cuisines = [k for k, _ in sorted(cuisine_counts.items(), key=lambda kv: kv[1], reverse=True)[:limit]]

        return {
            "supported_budget_buckets": [b.value for b in BudgetBucket],
            "locations": locations,
            "cuisines": cuisines,
            "notes": ["Phase 2 metadata derived from canonical SQLite."],
        }

