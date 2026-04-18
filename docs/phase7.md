# Phase 7 — Deployment, monitoring, and operations

This phase finalizes the end-to-end framework architecture by ensuring it is ready for resilient operations, structured logging, and production deployment across multiple frontends.

---

## What’s implemented

### 1. Local Unified Deployment via Docker
- **`Dockerfile`**: Packages the Phase 4 backend and Phase 5 static frontend correctly alongside Python dependencies in a lightweight format.
- **`docker-compose.yml`**: Simplifies startup sequences mapping ports and sharing local data layer `.env` state implicitly.

### 2. Split Frontend Deployment (Cloud)
- **Vercel static frontend**: `frontend/` is now deployable independently on Vercel using `vercel.json`.
- **Streamlit frontend**: `app.py` provides a self-contained Streamlit app that runs recommendation logic directly (no external API process).
- **Backend CORS support**: `backend/app.py` reads `CORS_ALLOW_ORIGINS` and enables controlled cross-origin access.
- **Frontend API base URL config**:
  - `frontend/config.js` sets `window.__API_BASE_URL__` for Vercel-hosted web UI.

### 3. Live Telemetry
- Structured JSON logging integrated deep within `backend/app.py`.
- **Fields Tracked**: `request_id`, `elapsed_ms`, `candidate_count`, `cache_hit`, `llm_used`, `fallback_used`, `model`, `relaxations_count`.
- **Benefits**: These outputs represent fully schema-compliant logs. Dashboards natively parse these properties without requiring external scrapers.

### 4. Resilience Playbooks
- **`docs/playbooks.md`**: Provides exact SOPs reflecting Phase 7 objectives detailing mitigation handles for AI Provider outages, dataset shifts, and traffic scale events.

---

## How to Deploy

### Option A — Local Docker deployment

To spin the recommendation engine locally:

```bash
# Provide variables
cp .env.example .env

# Deploy via Docker
docker-compose up --build -d
```

Check the logs for robust telemetry JSON lines:
```bash
docker-compose logs -f recommender-api
```

### Option B — Cloud split deployment (recommended)

#### Step 1: Deploy backend API
Deploy FastAPI (`backend.app:app`) to any Python host and configure:

- `GROQ_API_KEY`
- `RESTAURANTS_DB_PATH`
- `CORS_ALLOW_ORIGINS=https://<your-vercel-app>.vercel.app,https://<your-streamlit-app>.streamlit.app`

#### Step 2: Deploy web frontend on Vercel
1. Keep `vercel.json` at repo root (already added).
2. Set backend URL in `frontend/config.js`:

```js
window.__API_BASE_URL__ = "https://<your-backend-domain>";
```
3. Import repo in Vercel and deploy.

#### Step 3: Deploy Streamlit frontend
1. Use `app.py` as the Streamlit entrypoint.
2. No external backend URL is required for this mode.
