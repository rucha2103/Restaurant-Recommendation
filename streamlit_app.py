import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import streamlit as st


def get_api_base_url() -> str:
    default_url = os.environ.get("API_BASE_URL", "http://127.0.0.1:8000")
    secrets_url = st.secrets.get("API_BASE_URL", default_url)
    return str(secrets_url).rstrip("/")


def fetch_json(url: str, method: str = "GET", payload: dict | None = None) -> dict:
    body = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = Request(url=url, data=body, headers=headers, method=method)
    with urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


st.set_page_config(page_title="Palate - Streamlit", page_icon="🍽️", layout="wide")
st.title("Palate - Restaurant Recommendations")
st.caption("Streamlit frontend for the same FastAPI backend.")

api_base_url = get_api_base_url()
st.write(f"Using API: `{api_base_url}`")

try:
    metadata = fetch_json(f"{api_base_url}/metadata")
    locations = metadata.get("locations", [])
    cuisines = metadata.get("cuisines", [])
except (HTTPError, URLError, TimeoutError, ValueError) as exc:
    st.error(f"Could not load metadata from backend: {exc}")
    st.stop()

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
    payload = {
        "location": location,
        "budget": budget,
        "cuisine": cuisine,
        "minimum_rating": min_rating,
        "include_unrated": include_unrated,
        "top_n": top_n,
    }
    if additional_preferences.strip():
        payload["additional_preferences"] = additional_preferences.strip()

    try:
        response = fetch_json(
            f"{api_base_url}/recommendations",
            method="POST",
            payload=payload,
        )
    except HTTPError as exc:
        st.error(f"API returned an error: {exc.code} {exc.reason}")
        st.stop()
    except (URLError, TimeoutError, ValueError) as exc:
        st.error(f"Failed to call backend API: {exc}")
        st.stop()

    recommendations = response.get("recommendations", [])
    st.subheader("Results")
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
