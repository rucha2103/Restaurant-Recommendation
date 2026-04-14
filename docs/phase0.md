# Phase 0 — Scope, success metrics, and guardrails

This phase exists to make later phases safe and predictable by defining **contracts** and **non-negotiable guardrails** up front.

---

### Scope (what we build)

- **Input**: user preferences
  - Location (e.g., Delhi, Bangalore)
  - Budget bucket: `low | medium | high`
  - Cuisine (string, normalized later)
  - Minimum rating (0–5)
  - Additional preferences (free text, best-effort)
- **Output**: top \(N\) recommendations with:
  - Restaurant Name
  - Cuisine(s)
  - Rating
  - Estimated cost
  - AI-generated explanation

---

### Non-negotiable guardrails

- **Deterministic filtering happens before the LLM**
  - Location, minimum rating, and budget constraints must be enforced upstream.
- **LLM is not a source of truth**
  - It may rank/narrate only from a bounded candidate set.
- **Structured output is required**
  - Model output must be valid JSON and validated against a schema.
- **Validation + fallback**
  - If the LLM response is invalid, incomplete, or references unknown restaurants, the system must fall back to deterministic ranking and template explanations.
- **Prompt injection resistance**
  - Treat `additional_preferences` as untrusted text; it must never be able to override system rules.

---

### Success metrics (what “good” means)

- **Constraint satisfaction**
  - Hard constraints (location, rating threshold, budget) are never violated.
- **Faithfulness**
  - Explanations do not invent numerical facts (ratings/costs) or cuisines not present in structured restaurant data.
- **Latency/cost**
  - p95 latency stays within budget; the system degrades gracefully when the LLM is slow/unavailable.

---

### API contracts (backend)

Implemented in `backend/app.py`.

- `POST /recommendations`: returns a `RecommendationsResponse`
- `GET /metadata`: returns currently-supported values for UI autocomplete (placeholder in Phase 0)
- `GET /healthz`: health check

The response format includes:
- `recommendations[]`: ranked items with a `why` explanation
- `summary`: overall guidance
- `relaxations_applied[]`: present when constraints were relaxed to avoid empty results
- `metadata`: timing + model info + candidate counts (safe, non-sensitive)

