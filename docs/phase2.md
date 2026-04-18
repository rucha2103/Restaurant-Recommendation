a# Phase 2 — Preference parsing, normalization, and deterministic filtering

This phase implements the **baseline deterministic recommender** described in `docs/architecture.md`:

- Normalize user inputs (location, cuisine, budget bucket, min rating)
- Deterministically filter the canonical dataset (from Phase 1)
- Rank results with a simple, explainable score
- Apply a controlled **relaxation strategy** to avoid empty results
- Return results using the Phase 0 API contract

> Note: **Groq LLM** is planned for later phases (Phase 3+) to refine ranking and generate richer explanations, but **Phase 2 remains fully deterministic**.

---

### What’s implemented

- **Code**
  - `backend/phase2_recommender.py`: normalization, filtering, ranking, relaxations
  - `backend/app.py`: `/recommendations` now uses Phase 2 logic; `/metadata` reads from the DB
- **Data source**
  - Uses canonical SQLite from Phase 1: `data/restaurants.sqlite`

---

### Input normalization (current)

- **Location**
  - Trims whitespace, applies a small alias map (e.g., Bangalore/Bengaluru)
  - Uses exact case-insensitive matches against known dataset locations
  - Uses a conservative close-match fallback for typos
- **Cuisine**
  - Trims whitespace and applies a small synonym map (extendable)
- **Budget**
  - `low | medium | high` mapped to numeric ranges for `avg_cost_for_two`
- **Minimum rating**
  - Enforced as a numeric threshold; optional `include_unrated`

---

### Deterministic filtering

The filter is applied in this order:

1. **Location**: exact match on canonical `city` column (dataset field behaves like locality)
2. **Rating**
   - If `include_unrated=false`: only rows with `rating` present and \(rating \ge min\)
   - If `include_unrated=true`: allow missing ratings
3. **Budget range**: numeric match on `avg_cost_for_two` (requires cost present)
4. **Cuisine overlap**: checked in Python for portability (parses `cuisines_json`)

---

### Ranking

Baseline score (higher is better):
- Rating (highest weight)
- Rating count (small weight, sqrt-scaled)
- Cost proximity to the budget midpoint (small penalty)

This keeps the system deterministic and explainable.

---

### Relaxation strategy (to avoid empty results)

If strict constraints return no results, the system tries combinations in this order:

1. **Widen budget range** slightly (up to 2 widening steps)
2. **Relax cuisine constraint** (drop cuisine match entirely)
3. **Lower rating threshold** in 0.5 steps down to 0.0

All relaxations are returned in `relaxations_applied[]` so the UI can be transparent.

---

### How to run

1) Ensure Phase 1 has been run and `data/restaurants.sqlite` exists.

2) Start the API:

```bash
./.venv/bin/uvicorn backend.app:app --reload
```

3) Query recommendations:

```bash
curl -s -X POST "${BACKEND_URL}/recommendations" \
  -H "Content-Type: application/json" \
  -d '{
    "location": "BTM",
    "budget": "medium",
    "cuisine": "Chinese",
    "minimum_rating": 0,
    "top_n": 5,
    "include_unrated": true
  }' | python -m json.tool
```

Optional: set a custom DB path:

```bash
RESTAURANTS_DB_PATH="data/restaurants.sqlite" ./.venv/bin/uvicorn backend.app:app --reload
```

