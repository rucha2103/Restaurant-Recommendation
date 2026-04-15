import json
import logging
import os
from time import perf_counter
from typing import Any, Dict

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.models import Preferences, RecommendationsResponse, ResponseMetadata
from backend.phase2_recommender import DEFAULT_DB_PATH, metadata_from_db
from backend.phase4_service import RecommenderService, readiness

# Load environment variables for local development.
# - By default loads from `.env` at repo root.
# - Override path via `ENV_FILE=/path/to/.env`.
load_dotenv(os.environ.get("ENV_FILE", ".env"), override=False)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("recommender_api")

svc = RecommenderService()

app = FastAPI(
    title="Restaurant Recommendation API",
    version="0.1.0",
    description="Phases 0–4: contracts + caching + observability + Groq-constrained reranking.",
)

# CORS for split deployments (e.g. Vercel frontend / Streamlit frontend).
cors_origins = [
    origin.strip()
    for origin in os.environ.get("CORS_ALLOW_ORIGINS", "").split(",")
    if origin.strip()
]
if cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )


@app.get("/healthz")
def healthz() -> Dict[str, str]:
    return {"status": "ok"}

@app.get("/readyz")
def readyz() -> Dict[str, Any]:
    return readiness()


@app.get("/metadata")
def metadata() -> Dict[str, Any]:
    db_path = os.environ.get("RESTAURANTS_DB_PATH", DEFAULT_DB_PATH)
    return metadata_from_db(db_path=db_path)


def _phase0_request_id() -> str:
    # Keep stable and dependency-free for now; replace with UUIDv7/ULID later.
    # Using perf_counter_ns avoids wall-clock dependence in local dev.
    return f"req_{perf_counter():.6f}".replace(".", "_")


@app.post("/recommendations", response_model=RecommendationsResponse)
def recommendations(prefs: Preferences) -> RecommendationsResponse:
    t0 = perf_counter()
    request_id = _phase0_request_id()

    (recos, relaxations, notes, llm_used, model, fallback_used), cache_hit, timings = svc.recommend(prefs)

    elapsed_ms = int((perf_counter() - t0) * 1000)
    
    # Telemetry struct for Phase 7 Dashboards/Monitoring
    log_data = {
        "event": "recommendation_telemetry",
        "request_id": request_id,
        "elapsed_ms": elapsed_ms,
        "candidate_count": len(recos),
        "cache_hit": cache_hit,
        "llm_used": llm_used,
        "fallback_used": fallback_used,
        "model": model,
        "relaxations_count": len(relaxations)
    }
    logger.info(json.dumps(log_data))

    # Determine appropriate summary
    if len(recos) == 0:
        summary_text = "No recommendations found. Consider loosening constraints."
    elif llm_used:
        summary_text = "Groq-enhanced recommendations from the canonical dataset."
    else:
        summary_text = "Standard recommendations. (AI enhancement disabled or unavailable)."

    return RecommendationsResponse(
        recommendations=recos,
        summary=summary_text,
        relaxations_applied=relaxations,
        metadata=ResponseMetadata(
            request_id=request_id,
            elapsed_ms=elapsed_ms,
            timings_ms=timings,
            candidate_count=len(recos),
            cache_hit=cache_hit,
            llm_used=llm_used,
            model=model,
            fallback_used=fallback_used,
            notes=notes,
        ),
    )

# Serve frontend static files
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend"))
if os.path.isdir(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
