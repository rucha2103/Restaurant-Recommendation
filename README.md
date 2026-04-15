# AI-Powered Restaurant Recommendation System

This repo is being built phase-by-phase from `docs/architecture.md`.

## Phase 0 (implemented)

- **API contract is defined and enforced** via typed request/response models.
- **Guardrails are codified** (deterministic constraints first, LLM constrained to candidate set, validation + fallback).
- **Success metrics are defined** (constraint satisfaction, faithfulness, latency/cost) with a place to emit them in `metadata`.

## Quickstart (backend)

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.app:app --reload
```

Then open the interactive docs at `http://127.0.0.1:8000/docs`.

### Environment (.env)

The API auto-loads environment variables from `.env` at startup (or `ENV_FILE=...`).
Copy `.env.example` → `.env` and set `GROQ_API_KEY` to enable Phase 3.

## Phase 1 (data ingestion)

Ingest the Hugging Face Zomato dataset into a canonical SQLite DB and write a quality report:

```bash
./.venv/bin/pip install -r requirements.txt
./.venv/bin/python backend/ingest_zomato.py --db data/restaurants.sqlite --report-out data/quality_report.json
```

## Phase 2 (deterministic recommender)

Start the API (uses `data/restaurants.sqlite` by default):

```bash
./.venv/bin/uvicorn backend.app:app --reload
```

Example request:

```bash
curl -s -X POST "http://127.0.0.1:8000/recommendations" \
  -H "Content-Type: application/json" \
  -d '{ "location":"BTM","budget":"medium","cuisine":"Chinese","minimum_rating":0,"top_n":5,"include_unrated":true }'
```

## Phase 3–4 (Groq + caching/observability)

- Set `GROQ_API_KEY` in `.env` to enable Groq reranking.
- `GET /readyz` shows readiness (`db_ok`, `groq_key_present`).
- Repeat the same `/recommendations` request to see `metadata.cache_hit=true`.

## Docs

- `docs/architecture.md`: phase-wise plan
- `docs/phase0.md`: Phase 0 scope, guardrails, metrics, and contracts
- `docs/phase1.md`: Phase 1 ingestion + canonical store
- `docs/phase2.md`: Phase 2 deterministic recommender
- `docs/phase3.md`: Phase 3 Groq-constrained reranking

## Deployment: Vercel frontend + Streamlit frontend

This repo now supports two independent frontend deployments that consume the same backend API:

- `frontend/`: static web UI (deploy to Vercel)
- `streamlit_app.py`: Streamlit UI (deploy to Streamlit Community Cloud)

### 1) Deploy backend API first

Deploy the FastAPI backend (`backend.app:app`) on any Python host, then note the public URL, for example:

`https://your-backend.example.com`

Set backend env vars:

- `GROQ_API_KEY`
- `RESTAURANTS_DB_PATH`
- `CORS_ALLOW_ORIGINS=https://your-vercel-app.vercel.app,https://your-streamlit-app.streamlit.app`

### 2) Deploy static frontend on Vercel

The root includes `vercel.json` that serves files from `frontend/`.

Before deploy, set API URL in `frontend/config.js`:

```js
window.__API_BASE_URL__ = "https://your-backend.example.com";
```

Then import repo to Vercel and deploy.

### 3) Deploy Streamlit frontend on Streamlit Community Cloud

Use `streamlit_app.py` as the app entrypoint.

Set Streamlit secret:

```toml
API_BASE_URL = "https://your-backend.example.com"
```

The Streamlit app reads `API_BASE_URL` from Streamlit secrets first, then environment variables.

