# Phase 5 — Frontend/UI (user-friendly results and transparency)

This phase introduces a graphical user interface (GUI) to make the AI-powered restaurant recommender accessible without using a REST client (like Postman or cURL).

To avoid relying on heavy build tooling (like Node.js) or configuring complex CORS setups, the frontend is built entirely using standard cross-browser web technologies (HTML, CSS, JavaScript) and is served directly by the existing FastAPI backend.

---

## What’s implemented

### 1. Frontend SPA (`frontend/`)
- `index.html`
  - A semantic HTML foundation that mounts the preference form and results container.
  - Features smart `<datalist>` elements for dynamic, robust location and cuisine dropdowns.
- `style.css`
  - A premium, modern web aesthetics implementation.
  - Core styling includes dynamic CSS variables, glassmorphism features (smooth blur paneling), fluid responsive layout breakpoints, and clean typographic separation.
- `app.js`
  - Handles real-time DOM manipulations.
  - Automatically fetches from `/metadata` to populate datalist autocompletes.
  - Structures user inputs logically and securely dispatches requests to `POST /recommendations`.
  - Coordinates graceful asynchronous loading states (spinners and skeleton loaders).
  - Conditionally renders badges for uncertain or missing values directly reflecting the robust output schema, alongside parsing `relaxations_applied` when conditions are dynamically widened for the user.

### 2. Backend integration (`backend/app.py`)
- Standardized static endpoint serving. It uses `fastapi.staticfiles.StaticFiles` bound to the root `/` to serve the `frontend/` folder seamlessly.

---

## Behavior and Error Handling

- **Latency Handling:** Skeleton load cards mimic exact final content shapes while the Groq-enhanced ranking generates its output.
- **Normalization Transparency:** Displays explicit disclaimers and summaries depending on `llm_used` vs `fallback_used` flags. When a fallback happens due to missing Groq API constraints, the UI visibly acknowledges it natively.
- **Missing Data:** Formats `estimated_cost` gracefully, dropping to a "Cost Unknown" warning badge if dataset coverage fails.

---

## How to run

Start the application the same way as Phase 4:

```bash
uvicorn backend.app:app --reload
```

Then visit the frontend using your deployed frontend URL.
