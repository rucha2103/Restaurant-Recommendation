import os
from time import perf_counter
from typing import Any, Dict, Tuple

import streamlit as st
from pydantic import ValidationError

from backend.models import Preferences
from backend.phase2_recommender import DEFAULT_DB_PATH, metadata_from_db
from backend.phase4_service import RecommenderService


def _to_dict(model_obj: Any) -> Dict[str, Any]:
    if hasattr(model_obj, "model_dump"):
        return model_obj.model_dump()
    return model_obj.dict()


@st.cache_data(show_spinner=False)
def get_metadata(db_path: str) -> Dict[str, Any]:
    return metadata_from_db(db_path=db_path)


@st.cache_resource(show_spinner=False)
def get_recommender_service() -> RecommenderService:
    return RecommenderService()


def get_recommendations(payload: Dict[str, Any]) -> Tuple[Dict[str, Any], str]:
    try:
        prefs = Preferences(**payload)
    except ValidationError as exc:
        return {"recommendations": [], "metadata": {"notes": [str(exc)]}}, "Invalid inputs."

    svc = get_recommender_service()
    t0 = perf_counter()
    (recos, relaxations, notes, llm_used, model, fallback_used), cache_hit, timings = svc.recommend(prefs)
    elapsed_ms = int((perf_counter() - t0) * 1000)

    if len(recos) == 0:
        summary_text = "No recommendations found. Consider loosening constraints."
    elif llm_used:
        summary_text = "Groq-enhanced recommendations from the canonical dataset."
    else:
        summary_text = "Standard recommendations. (AI enhancement disabled or unavailable)."

    response = {
        "recommendations": [_to_dict(r) for r in recos],
        "summary": summary_text,
        "relaxations_applied": [_to_dict(r) for r in relaxations],
        "metadata": {
            "elapsed_ms": elapsed_ms,
            "timings_ms": timings,
            "candidate_count": len(recos),
            "cache_hit": cache_hit,
            "llm_used": llm_used,
            "model": model,
            "fallback_used": fallback_used,
            "notes": notes,
        },
    }
    return response, summary_text


st.set_page_config(page_title="Palate - Streamlit", page_icon="🍽️", layout="wide")
st.title("Palate - Restaurant Recommendations")
st.caption("Self-contained Streamlit app (no external API server required).")

db_path = os.environ.get("RESTAURANTS_DB_PATH", DEFAULT_DB_PATH)
metadata = get_metadata(db_path)
locations = metadata.get("locations", [])
cuisines = metadata.get("cuisines", [])

if metadata.get("notes"):
    st.info(" | ".join(metadata["notes"]))

with st.form("prefs_form"):
    left, right = st.columns(2)
    with left:
        location = st.selectbox("Location", options=locations or ["BTM"])
        cuisine = st.selectbox("Cuisine", options=cuisines or ["Chinese"])
        min_rating = st.slider("Minimum rating", 0.0, 5.0, 3.5, 0.1)
    with right:
        budget = st.selectbox("Budget", options=["low", "medium", "high"], index=1)
        include_unrated = st.checkbox("Include unrated", value=True)
        top_n = st.slider("How many recommendations?", 1, 10, 5, 1)

    additional_preferences = st.text_area("Additional preferences", "")
    submitted = st.form_submit_button("Get Recommendations")

if submitted:
    payload: Dict[str, Any] = {
        "location": location,
        "budget": budget,
        "cuisine": cuisine,
        "minimum_rating": min_rating,
        "include_unrated": include_unrated,
        "top_n": top_n,
    }
    if additional_preferences.strip():
        payload["additional_preferences"] = additional_preferences.strip()

    response, summary = get_recommendations(payload)
    recommendations = response.get("recommendations", [])

    st.subheader("Results")
    st.caption(summary)
    if not recommendations:
        st.info("No matching restaurants found for these constraints.")
    else:
        for rec in recommendations:
            rating = rec.get("rating")
            cost = rec.get("estimated_cost")
            currency = rec.get("currency", "₹")
            with st.container(border=True):
                st.markdown(f"**{rec.get('name', 'Unknown')}** - {rec.get('location', 'Unknown')}")
                st.write(", ".join(rec.get("cuisines", [])))
                st.write(f"Rating: {rating if rating is not None else 'N/A'}")
                if cost is not None:
                    st.write(f"Estimated cost: {currency}{cost} for two")
                why = rec.get("why")
                if why:
                    st.caption(why)
