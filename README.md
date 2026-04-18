# Restaurant Recommendation System

Architecture:

- `backend/streamlit_backend.py`: Streamlit app acting as backend-style API via query params.
- `frontend/`: Next.js frontend (deployable on Vercel) calling the Streamlit backend over HTTP.

## Backend (Streamlit)

The Streamlit backend supports API-like endpoints:

- `/?endpoint=metadata`
- `/?endpoint=recommendations&location=...&budget=...&cuisine=...`

Run locally:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
streamlit run backend/streamlit_backend.py
```

## Frontend (Next.js)

Setup:

```bash
cd frontend
npm install
cp .env.example .env.local
```

Set `NEXT_PUBLIC_API_BASE_URL` in `frontend/.env.local` to your deployed Streamlit app URL:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-streamlit-app.streamlit.app
```

Run locally:

```bash
npm run dev
```

## Deployment

### Deploy backend on Streamlit Community Cloud

1. Connect GitHub repo on [Streamlit Community Cloud](https://share.streamlit.io/).
2. App file path: `backend/streamlit_backend.py`
3. Add secrets/env values if needed:
   - `GROQ_API_KEY`
   - `RESTAURANTS_DB_PATH` (optional, defaults to `data/restaurants.sqlite`)

### Deploy frontend on Vercel

1. Import the same repo on [Vercel](https://vercel.com/).
2. Set project root to `frontend`.
3. Add env var:
   - `NEXT_PUBLIC_API_BASE_URL=https://your-streamlit-app.streamlit.app`
4. Deploy.

## Docs

- `docs/architecture.md`
- `docs/phase0.md`
- `docs/phase1.md`
- `docs/phase2.md`
- `docs/phase3.md`
- `docs/phase7.md`

