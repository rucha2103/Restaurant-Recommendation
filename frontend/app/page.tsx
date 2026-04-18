"use client";

import { FormEvent, useEffect, useState } from "react";

type MetadataResponse = {
  locations: string[];
  cuisines: string[];
};

type Recommendation = {
  name: string;
  location: string;
  cuisines: string[];
  rating?: number | null;
  estimated_cost?: number | null;
  currency?: string | null;
  why?: string;
};

type RecommendationsResponse = {
  summary?: string;
  recommendations: Recommendation[];
};

export default function HomePage() {
  const [locations, setLocations] = useState<string[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<Recommendation[]>([]);
  const [summary, setSummary] = useState("");

  const [location, setLocation] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [budget, setBudget] = useState("medium");
  const [minimumRating, setMinimumRating] = useState("3.5");
  const [includeUnrated, setIncludeUnrated] = useState(true);
  const [topN, setTopN] = useState("5");
  const [additionalPreferences, setAdditionalPreferences] = useState("");

  useEffect(() => {
    const loadMetadata = async () => {
      setError("");
      try {
        const response = await fetch("/api/metadata");
        const data: MetadataResponse = await response.json();
        setLocations(data.locations || []);
        setCuisines(data.cuisines || []);
      } catch {
        setError("Failed to load metadata.");
      }
    };
    loadMetadata();
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResults([]);
    setSummary("");

    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location,
          cuisine,
          budget,
          minimum_rating: Number(minimumRating),
          include_unrated: includeUnrated,
          top_n: Number(topN),
          additional_preferences: additionalPreferences.trim() || undefined
        })
      });
      const data: RecommendationsResponse = await response.json();
      if (!response.ok) {
        throw new Error("Recommendations API request failed.");
      }
      setSummary(data.summary || "");
      setResults(data.recommendations || []);
    } catch {
      setError("Could not fetch recommendations. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container">
      <h1>Palate Recommendations</h1>
      <p className="muted">Next.js frontend on Vercel with Streamlit backend APIs.</p>

      <form className="panel" onSubmit={onSubmit}>
        <div className="grid">
          <div>
            <label htmlFor="location">Location</label>
            <select id="location" value={location} onChange={(e) => setLocation(e.target.value)} required>
              <option value="">Select a location</option>
              {locations.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="cuisine">Cuisine</label>
            <select id="cuisine" value={cuisine} onChange={(e) => setCuisine(e.target.value)} required>
              <option value="">Select a cuisine</option>
              {cuisines.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="budget">Budget</label>
            <select id="budget" value={budget} onChange={(e) => setBudget(e.target.value)}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </div>
          <div>
            <label htmlFor="minimumRating">Minimum rating</label>
            <input
              id="minimumRating"
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={minimumRating}
              onChange={(e) => setMinimumRating(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="topN">Top N</label>
            <input id="topN" type="number" min="1" max="10" value={topN} onChange={(e) => setTopN(e.target.value)} />
          </div>
          <div>
            <label htmlFor="includeUnrated">Include unrated</label>
            <select
              id="includeUnrated"
              value={includeUnrated ? "true" : "false"}
              onChange={(e) => setIncludeUnrated(e.target.value === "true")}
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: "0.85rem" }}>
          <label htmlFor="preferences">Additional preferences</label>
          <textarea
            id="preferences"
            rows={3}
            value={additionalPreferences}
            onChange={(e) => setAdditionalPreferences(e.target.value)}
          />
        </div>

        <div style={{ marginTop: "1rem" }}>
          <button type="submit" disabled={loading}>
            {loading ? "Loading..." : "Get Recommendations"}
          </button>
        </div>
      </form>

      {error ? <p className="error">{error}</p> : null}

      <section className="results">
        {summary ? <p className="muted">{summary}</p> : null}
        {results.map((rec) => (
          <article className="card" key={`${rec.name}-${rec.location}`}>
            <h3 style={{ margin: 0 }}>{rec.name}</h3>
            <p className="muted" style={{ marginTop: "0.35rem" }}>
              {rec.location}
            </p>
            <p>{(rec.cuisines || []).join(", ")}</p>
            <p>Rating: {rec.rating ?? "N/A"}</p>
            <p>
              Cost: {rec.estimated_cost != null ? `${rec.currency || "₹"}${rec.estimated_cost} for two` : "Unknown"}
            </p>
            {rec.why ? <p className="muted">{rec.why}</p> : null}
          </article>
        ))}
      </section>
    </main>
  );
}
