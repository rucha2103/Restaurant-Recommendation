# Phase 3 — Groq LLM integration (constrained rerank + faithful explanations)

Phase 3 enhances Phase 2 recommendations by using an LLM (Groq) to rerank a **bounded candidate set** and produce explanations.

---

## Key design constraints (to prevent hallucinations)

- **LLM sees only candidates** produced by Phase 2 filtering/ranking.
- **LLM must output strict JSON only** (no markdown fences).
- **Validation + fallback**:
  - If Groq is missing/unreachable, output Phase 2 results.
  - If Groq returns invalid JSON, unknown restaurant ids, or “unsafe” numeric faithfulness, sanitize or fall back.
- **Prompt injection resistance**:
  - `additional_preferences` is treated as untrusted text and cannot override system rules.

---

## Implementation

- `backend/phase3_recommender.py`
  - Builds a prompt containing:
    - normalized user preferences
    - an array of candidate restaurants (limited fields only)
  - Calls Groq via `GROQ_API_KEY`
  - Parses and validates the structured response
  - Produces final `Recommendation` objects using candidate structured fields + LLM-provided `why`

---

## Faithfulness validation (numeric)

Phase 3 includes a heuristic guard against numeric hallucinations:

- Extracts numbers from the LLM `why`
- Ensures each number approximately matches either:
  - candidate `rating` (or 1-decimal rounding), or
  - candidate `estimated_cost` (within relative/absolute tolerance)
- If the check fails, the system replaces the explanation with a generic, non-numeric message.

---

## Runtime behavior & metadata

`POST /recommendations` returns the same API shape as Phase 2, but:

- `metadata.llm_used=true` only when Groq JSON parsing succeeds and candidate ids validate.
- `metadata.fallback_used=true` when Phase 3 skips Groq or fails validation and returns deterministic Phase 2 results.
- `metadata.model` contains the Groq model name used.

---

## How to run

1) Ensure Phase 1 ingestion is done (so `data/restaurants.sqlite` exists).

2) Start the API:

```bash
./.venv/bin/uvicorn backend.app:app --reload
```

3) (Optional) Enable Groq:

```bash
export GROQ_API_KEY="..."
export GROQ_MODEL="llama-3.1-8b-instant"
```

If `GROQ_API_KEY` is not set, Phase 3 automatically falls back to Phase 2.

