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
    <>
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">🍽️ Palate</h1>
          <p className="hero-subtitle">Discover Your Perfect Dining Experience</p>
          <p className="hero-subtitle">AI-Powered Restaurant Recommendations Tailored Just for You</p>
        </div>
      </section>

      {/* Form Section */}
      <div className="container">
        <div className="form-section">
          <h2 className="form-title">Find Your Perfect Restaurant</h2>
          <p className="form-subtitle">Tell us your preferences and let our AI recommend the best dining spots</p>
          
          <form onSubmit={onSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="location" className="form-label">📍 Location</label>
                <select 
                  id="location" 
                  className="select-field" 
                  value={location} 
                  onChange={(e) => setLocation(e.target.value)} 
                  required
                >
                  <option value="">Select a location</option>
                  {locations.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="cuisine" className="form-label">🍜 Cuisine</label>
                <select 
                  id="cuisine" 
                  className="select-field" 
                  value={cuisine} 
                  onChange={(e) => setCuisine(e.target.value)} 
                  required
                >
                  <option value="">Select a cuisine</option>
                  {cuisines.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="budget" className="form-label">💰 Budget</label>
                <select 
                  id="budget" 
                  className="select-field" 
                  value={budget} 
                  onChange={(e) => setBudget(e.target.value)}
                >
                  <option value="low">Budget Friendly</option>
                  <option value="medium">Moderate</option>
                  <option value="high">Fine Dining</option>
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="minimumRating" className="form-label">⭐ Minimum Rating</label>
                <input
                  id="minimumRating"
                  className="input-field"
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={minimumRating}
                  onChange={(e) => setMinimumRating(e.target.value)}
                  placeholder="3.5"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="topN" className="form-label">🔢 Number of Recommendations</label>
                <input 
                  id="topN" 
                  className="input-field" 
                  type="number" 
                  min="1" 
                  max="10" 
                  value={topN} 
                  onChange={(e) => setTopN(e.target.value)} 
                  placeholder="5"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="includeUnrated" className="form-label">📊 Include Unrated</label>
                <select
                  id="includeUnrated"
                  className="select-field"
                  value={includeUnrated ? "true" : "false"}
                  onChange={(e) => setIncludeUnrated(e.target.value === "true")}
                >
                  <option value="true">Yes, include hidden gems</option>
                  <option value="false">No, only rated places</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="preferences" className="form-label">💭 Additional Preferences</label>
              <textarea
                id="preferences"
                className="textarea-field"
                rows={3}
                value={additionalPreferences}
                onChange={(e) => setAdditionalPreferences(e.target.value)}
                placeholder="E.g., outdoor seating, vegetarian options, quiet atmosphere..."
              />
            </div>

            <div style={{ textAlign: "center", marginTop: "2rem" }}>
              <button type="submit" className="button-primary" disabled={loading}>
                {loading ? (
                  <>
                    <span className="loading-spinner"></span>
                    Finding Perfect Matches...
                  </>
                ) : (
                  "🔍 Get Recommendations"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Error/Loading Messages */}
        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}
        
        {loading && (
          <div className="loading-message">
            <span className="loading-spinner"></span>
            Our AI is analyzing your preferences and finding the best restaurants...
          </div>
        )}

        {/* Results Section */}
        {results.length > 0 && (
          <section className="results-section">
            <div className="results-header">
              <h2 className="results-title">🍽️ Recommended Restaurants</h2>
              <p className="results-subtitle">
                {summary || "Here are your personalized recommendations"}
              </p>
            </div>
            
            <div className="restaurant-grid">
              {results.map((rec, index) => (
                <article className="restaurant-card" key={`${rec.name}-${rec.location}-${index}`}>
                  <h3 className="restaurant-name">{rec.name}</h3>
                  <div className="restaurant-location">
                    📍 {rec.location}
                  </div>
                  <div className="restaurant-cuisines">
                    🍽️ {(rec.cuisines || []).join(" • ")}
                  </div>
                  
                  <div className="restaurant-details">
                    <div className="detail-item rating">
                      ⭐ {rec.rating ? `${rec.rating}/5` : "Not Rated"}
                    </div>
                    <div className="detail-item cost">
                      💰 {rec.estimated_cost != null ? `${rec.currency || "₹"}${rec.estimated_cost} for two` : "Price not available"}
                    </div>
                  </div>
                  
                  {rec.why && (
                    <div className="restaurant-why">
                      💡 <strong>Why we recommend:</strong> {rec.why}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
