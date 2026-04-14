# Operational Playbooks

This document contains standard operating procedures (SOPs) for the AI Recommender System, maintaining alignment with Phase 7 operational resilience goals.

## 1. LLM Outage or High Error Rates

**Symptoms:**
- Elevated timeout rates detected on `recommendation_telemetry` logs.
- Spikes in `fallback_used: True` values across metric dashboards.
- Groq status page indicates degraded performance.

**Action:**
1. Determine if the outage is isolated to our API keys (rate limiting) or global (Groq provider issue).
2. The service is **designed to self-heal**. Phase 3 logic will automatically catch timeout and JSON exceptions, immediately pivoting to deterministic fallback strategies for results.
3. No manual intervention is typically required, but if API exhaustion triggers recursive long timeouts, temporarily clear the `GROQ_API_KEY` from `.env` and restart containers (`docker-compose restart`) to instantly cut all outbound AI requests until upstream stability returns.

## 2. Ingestion Failures

**Symptoms:**
- The automated Phase 1 dataset parser (`ingest_zomato.py`) fails mid-run.
- Database locks or integrity exceptions logged locally.

**Action:**
1. The ingestion job writes to temporary/new variants before overwriting the active DB whenever possible (idempotency feature).
2. If the active `restaurants.db` is corrupted, replace it with the last known good snapshot (typically managed via regular backups or re-running the ingestor exactly against pinned HuggingFace versions).
3. Check `records_ingested` vs `null` anomaly thresholds if the dataset format radically shifted upstream. Maintain local dataset pin versions.

## 3. Traffic Spikes & High Load

**Symptoms:**
- App latency `elapsed_ms` logs jumping consistently > 3000ms.
- 100% CPU utilization on Docker engine.

**Action:**
1. Our architecture implements `InMemoryTTLCache` specifically keyed by normalized attributes. Under high load, cache hit rates will naturally absorb perfectly identical requests.
2. If traffic continues exceeding Node allocations, scale the API service horizontally. Update the load balancer upstream and run:
   ```bash
   docker-compose up --scale recommender-api=3 -d
   ```
3. To limit abuse, consider mounting an API gateway limit directly before Docker (e.g. NGINX `limit_req`).
