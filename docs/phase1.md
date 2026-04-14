# Phase 1 — Data ingestion and canonical restaurant model

This phase implements the **repeatable ingestion job** that pulls the Zomato dataset from Hugging Face and writes a **canonical restaurant store** plus a **data quality report**.

---

### What this phase produces

- **Canonical SQLite DB**: `data/restaurants.sqlite`
  - Table: `restaurants`
  - Table: `ingestion_runs` (metadata for reproducibility and audit)
- **Quality report JSON**: `data/quality_report.json`
  - Null rates (city, rating, cost, cuisines)
  - Top cities
  - Top cuisines (computed in Python for SQLite compatibility)

---

### How to run

From the repo root:

```bash
./.venv/bin/pip install -r requirements.txt
./.venv/bin/python backend/ingest_zomato.py --db data/restaurants.sqlite --report-out data/quality_report.json
```

Optional flags:
- `--split train`: choose the dataset split
- `--revision <commit/tag>`: pin a dataset revision for reproducibility

---

### Canonical schema (SQLite)

`restaurants`
- `restaurant_id` (TEXT, PK): stable hash of identifying fields and source row
- `name` (TEXT, NOT NULL)
- `city` (TEXT, nullable)
- `area` (TEXT, nullable)
- `cuisines_json` (TEXT, NOT NULL): JSON list of cuisines
- `avg_cost_for_two` (REAL, nullable)
- `currency` (TEXT, nullable)
- `rating` (REAL, nullable)
- `rating_count` (INTEGER, nullable)
- `source_row_json` (TEXT, NOT NULL): raw source row stored as JSON for traceability
- `ingested_at` (TEXT, NOT NULL): ISO timestamp of canonical write

`ingestion_runs`
- `run_id` (TEXT, PK)
- `dataset_id` (TEXT, NOT NULL)
- `dataset_revision` (TEXT, nullable)
- `split_name` (TEXT, NOT NULL)
- `started_at` (TEXT, NOT NULL)
- `finished_at` (TEXT, nullable)
- `row_count` (INTEGER, NOT NULL)

Indexes:
- `idx_restaurants_city` on `city`
- `idx_restaurants_rating` on `rating`
- `idx_restaurants_cost` on `avg_cost_for_two`

---

### Common ingestion nuances handled

- **Missing/dirty fields**: rating/cost/cuisines may be blank or non-numeric; these are normalized to null/empty list.
- **Cuisine parsing**: supports strings and lists; splits on common separators and de-duplicates while preserving order.
- **Location fields vary by dataset**: if no distinct `city` exists, a single `location` field is treated as `city`.
- **Idempotency**: restaurants are upserted by `restaurant_id`.

