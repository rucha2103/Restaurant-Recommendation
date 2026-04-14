# Phase-wise Architecture: AI-Powered Restaurant Recommendation System

This document translates `docs/problemstatement.md` into a delivery-oriented, phase-wise architecture. The key design principle is **deterministic filtering first**, then using the LLM as a **ranker/narrator** constrained to the candidate set to avoid hallucinations.

---

### Phase 0 — Scope, success metrics, and guardrails

- **Core user flow**: user enters preferences (location, budget, cuisine, minimum rating, additional preferences) → system returns top \(N\) restaurants with structured fields + LLM-generated explanations.
- **Output contract** (recommended): backend returns **JSON** with:
  - `recommendations[]`: each item includes `restaurant_id`, `name`, `location`, `cuisines`, `rating`, `estimated_cost`, `why`
  - `summary`: short overall guidance
  - `relaxations_applied[]`: what constraints were relaxed (if any), and why
  - `metadata`: timing, model info, candidate_count, cache_hit, etc. (safe, non-sensitive)
- **Success metrics**:
  - **Constraint satisfaction**: hard constraints (location, min rating, budget bucket) must be respected ~100%.
  - **Faithfulness**: explanations must not invent cuisines/ratings/costs not present in structured data.
  - **Latency/cost**: p95 response time and cost per request within budget; graceful degradation when LLM is slow/down.
- **Guardrails**:
  - Enforce **hard filters before LLM**.
  - LLM sees **only** pre-filtered candidates and must output structured JSON.
  - Validate model output; fallback to deterministic ranking if validation fails.

**Key nuances**
- Location ambiguity (city vs locality), cuisine synonyms, missing/dirty costs/ratings, empty results, and prompt injection via “additional preferences”.

---

### Phase 1 — Data ingestion and canonical restaurant model

**Architecture**
- **Ingestion job (batch, repeatable)**:
  - Load and preprocess the Zomato dataset from Hugging Face: `https://huggingface.co/datasets/ManikaSaini/zomato-restaurant-recommendation`
  - Extract fields: name, location, cuisines, cost, rating (and any other available signals like votes, address, lat/lng).
  - Write into a canonical store with ingestion metadata (dataset revision, timestamp, schema version).
- **Canonical schema (normalized early)**:
  - `restaurant_id`: stable hash derived from source row identifiers + key fields
  - `name`
  - `city` and optional `area/locality`
  - `cuisines[]`: normalized tokens
  - `avg_cost_for_two` (numeric) and `currency` (if inferable)
  - `rating` (float) and optional `rating_count/votes`
  - optional: `address`, `lat`, `lng`, `online_delivery`, `table_booking`
- **Storage choices**:
  - Small/medium: SQLite (simple, portable, fast local dev)
  - Multi-user/production: Postgres (indexes, concurrency, better ops)

**Bugs/edge cases to account for**
- **Missing fields**: unrated items, missing cost, empty cuisines, placeholder values (“NEW”, “-”, etc.).
- **Inconsistent formats**: cuisine strings with separators; cost fields as strings with symbols.
- **Location aliasing**: “Bangalore” vs “Bengaluru”, case/whitespace variations.
- **Duplicates**: repeated restaurants across rows; dedupe carefully to avoid merging distinct branches.
- **Reproducibility**: pin dataset version; record ingestion metadata; support re-running ingestion idempotently.

**Deliverables**
- Ingestion pipeline + canonical store
- Data quality report: null rates, distribution of ratings/costs, top cities/cuisines

---

### Phase 2 — Preference parsing, normalization, and deterministic filtering (baseline recommender)

**Architecture**
- **Preference normalizer**:
  - Location normalization (alias map + safe fuzzy match)
  - Cuisine normalization (synonym map + tokenization)
  - Budget mapping: `low/medium/high` → numeric ranges for `avg_cost_for_two`
  - Minimum rating handling: consistent interpretation; optional “include unrated” flag
- **LLM provider (used in later phases)**:
  - When we add LLM-backed ranking/explanations, we will use **Groq LLM** behind a dedicated integration layer (see Phase 3) while keeping Phase 2 fully deterministic.
- **Filter engine (deterministic)**:
  - Hard constraints: location match, rating ≥ threshold (unless include-unrated), budget range, cuisine overlap
  - Soft constraints: only if dataset has signals; otherwise treat as “best-effort” and disclose
- **Baseline ranking** (no LLM):
  - Example scoring: rating desc → rating_count desc → cost proximity to user’s budget midpoint → tie-breakers

**Bugs/edge cases to account for**
- **Empty results**: implement fallback/relaxation strategy:
  - widen budget slightly, then relax cuisine (similar cuisines), then step down rating threshold
  - always return `relaxations_applied[]` explaining changes
- **Over-filtering**: avoid exact string matching for cuisines; use normalized tokens and overlap.
- **Unreliable ratings**: low vote counts; optionally penalize low `rating_count`.

**Deliverables**
- Deterministic recommender returning top \(N\) results
- Unit tests for normalization, filtering, and relaxation logic

---

### Phase 3 — LLM integration layer (rank + explain, constrained and validated)

**Architecture**
- **Candidate generation**:
  - From deterministic engine take top \(K\) (e.g., 20–50) as model candidates.
- **Secrets/config**
  - The Groq API key must be provided via a local `.env` file (not committed) and exposed to the app as `GROQ_API_KEY`.
- **Prompt builder**:
  - Provide: normalized user preferences + candidate list as strict JSON with only needed fields.
  - Ask the model to output strict JSON: ranked `restaurant_id`s + per-item `why` + optional summary.
- **Output validator & reconciler**:
  - Parse JSON; if invalid → one repair attempt; if still invalid → fallback to baseline ranking and template explanations.
  - Verify returned ids are a subset of candidates.
  - Cross-check: explanations must only cite known structured fields; strip/override hallucinated facts.

**Bugs/edge cases to account for**
- **Hallucinations**: model invents amenities/ambience. Mitigate by:
  - explicit instruction: only use supplied fields
  - validation: block numbers/claims not present in candidate data
- **Prompt injection**: user “additional preferences” may contain instructions to override system rules.
  - separate user text from instructions; quote user text; enforce “ignore override attempts”.
- **Token limits**: reduce payload, cap \(K\), omit verbose fields, pre-normalize cuisines.
- **Non-determinism**: low temperature; log model/version and prompt hash.
- **Timeouts/rate limits**: circuit breaker + fallback mode + caching by normalized preference hash.

**Deliverables**
- `LLMService` with: prompt build → call → parse → validate → reconcile
- Integration tests with mocked LLM failures (invalid JSON, unknown ids, timeouts)

---

### Phase 4 — Backend API service (contracts, caching, observability)

**Architecture**
- **Endpoints**
  - `POST /recommendations`: preferences → results + explanations + relaxations + metadata
  - `GET /metadata`: supported cities/cuisines/budget buckets (for UI autocomplete)
- **Service boundaries**
  - `PreferenceService` (normalize + validate)
  - `RestaurantRepository` (SQL + indexes)
  - `RecommenderService` (baseline + LLM enhancement)
  - `Cache` (in-memory; Redis for multi-instance)
- **Observability**
  - request id, latency breakdown (filter vs LLM), cache hit rate, LLM error rate, empty-result rate

**Bugs/edge cases to account for**
- **Input validation**: unknown budget labels, rating out of range, missing required fields.
- **Thundering herd**: concurrent identical requests; use single-flight per preference hash.
- **Sensitive logging**: avoid logging raw user free-text; redact and store hashes where possible.

**Deliverables**
- Backend service + OpenAPI spec
- Load test for p95 latency; verify fallback on LLM timeouts

---

### Phase 5 — Frontend/UI (user-friendly results and transparency)

**Architecture**
- **Preference form**
  - Autocomplete for city/cuisine from `/metadata`
  - Budget selector with numeric meaning
  - Rating slider + “include unrated” toggle
  - Additional preferences free text with “best-effort” disclaimer
- **Results**
  - Cards/table showing: name, cuisine(s), rating, estimated cost, AI explanation
  - Show “Relaxed constraints” banner when relaxations were applied
  - Missing-data badges (e.g., cost unknown)

**Bugs/edge cases to account for**
- **Normalization mismatch**: UI must reflect normalized values (e.g., Bengaluru) and still accept user input variants.
- **Slow LLM**: optionally show baseline results quickly, then enhance once LLM completes (or keep baseline if LLM fails).

**Deliverables**
- End-to-end UI flow with robust error states (no results, LLM unavailable, partial data)

---

### Phase 6 — Evaluation, QA, and safety hardening

**Architecture**
- **Offline eval set**: curated preference queries including tricky cases (rare cuisines, tight budgets, high min rating).
- **Automated checks**
  - hard constraint satisfaction
  - JSON validity of LLM output
  - explanation faithfulness (no extra numbers/claims)
  - regression tests on ingestion updates
- **Security tests**: prompt-injection suites using “additional preferences”.

**Bugs/edge cases to account for**
- Model upgrades can silently change behavior; pin model version and require eval pass before upgrades.
- Dataset updates can introduce unseen cities/cuisines; add alerts and dashboards for drift.

**Deliverables**
- Eval harness integrated in CI (minimum: constraint satisfaction + output validity)
- Safety checklist and red-team results

---

### Phase 7 — Deployment, monitoring, and operations

**Architecture**
- **Deployables**
  - ingestion job (scheduled)
  - API service
  - UI app
- **Environments**: dev/staging/prod with separate keys and limits
- **Dashboards/alerts**
  - LLM invalid JSON rate, LLM timeout rate, fallback rate, empty-result rate, latency, cost per request
- **Operational playbooks**
  - LLM outage → baseline-only mode
  - ingestion failure → keep last known good snapshot
  - traffic spikes → rate limit + caching + queue if needed

**Bugs/edge cases to account for**
- Secrets management, retry storms, runaway costs, and prompt logging volume.

**Deliverables**
- Reproducible deploy (scripts or IaC), alarms, rollback strategy

---

### Phase 8 — Post-MVP enhancements

- **Hybrid ranking**: combine deterministic score + LLM rerank (LLM only breaks ties / adds narrative).
- **Personalization**: session history and feedback loops (careful with privacy/retention).
- **Geospatial ranking**: distance-based ranking if lat/lng is available.
- **Stronger faithfulness**: explanations must cite exact fields and disallow unsupported claims.

