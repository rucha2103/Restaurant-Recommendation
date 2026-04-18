# Phase 7 — Deployment, monitoring, and operations

Phase 7 now runs as split cloud architecture:

- Streamlit app in `backend/streamlit_backend.py` acts as backend-style API.
- Next.js app in `frontend/` acts as presentation layer deployed on Vercel.

---

## What’s implemented

### 1. Streamlit backend-like API mode
- `/?endpoint=metadata` returns metadata JSON.
- `/?endpoint=recommendations` returns recommendations JSON from query params.
- Endpoint mode returns `st.json(...)` and exits early (no UI rendering).
- Caching is enabled with `st.cache_data` and `st.cache_resource`.

### 2. Next.js frontend for Vercel
- `frontend/app/page.tsx` provides recommendation UI.
- `frontend/app/api/metadata/route.ts` and `frontend/app/api/recommendations/route.ts` proxy to Streamlit.
- `NEXT_PUBLIC_API_BASE_URL` controls which Streamlit deployment is used.

### 3. Operational benefits
- No localhost dependency in deployed flow.
- Frontend and backend can scale/deploy independently.
- Existing recommendation logic is reused directly from backend modules.

---

## Deployment flow

1. Deploy Streamlit backend on [Streamlit Community Cloud](https://share.streamlit.io/).
   - Entry file: `backend/streamlit_backend.py`
2. Deploy Next.js frontend on [Vercel](https://vercel.com/).
   - Project root: `frontend`
   - Env var: `NEXT_PUBLIC_API_BASE_URL=https://<your-streamlit-app>.streamlit.app`

This gives: `Vercel frontend -> Streamlit endpoint mode -> JSON response -> UI render`.
