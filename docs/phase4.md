# Phase 4 — Backend API service (contracts, caching, observability)

This phase hardens the backend API around the existing recommender by adding:

- **Service boundaries** (lightweight)
- **In-memory caching** (TTL-based)
- **Observability hooks** (timing breakdown + readiness)

---

## What’s implemented

- `backend/phase4_service.py`
  - `RecommenderService`: wraps recommendation calls
  - `InMemoryTTLCache`: TTL cache keyed by normalized preferences hash
  - `readiness()`: checks DB existence + whether `GROQ_API_KEY` is present
- `backend/app.py`
  - Uses `RecommenderService` for `/recommendations`
  - Adds `GET /readyz` readiness endpoint
  - Adds `metadata.timings_ms` and real `metadata.cache_hit`

---

## Cache behavior

- **Keying**: based on normalized preference fields; does **not** include raw `additional_preferences` text (privacy + cardinality).
- **TTL**: `CACHE_TTL_S` (default 30s)
- **Size cap**: `CACHE_MAX_ITEMS` (default 512)
- **Eviction**: basic expiry cleanup / oldest-expiry eviction

---

## Observability

`metadata.timings_ms` includes:
- `total`: overall time in service wrapper
- `llm_plus_rank`: time spent in rerank + LLM path (includes deterministic baseline)

Readiness:
- `GET /readyz` returns whether the canonical DB is present and whether the Groq key is configured.

---

## How to run

```bash
./.venv/bin/uvicorn backend.app:app --reload
```

Then:
- `GET /readyz`
- `POST /recommendations`

