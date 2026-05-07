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
  const [budget, setBudget] = useState(1); // 0=low, 1=medium, 2=high
  const [minimumRating, setMinimumRating] = useState(3.5);
  const [includeUnrated, setIncludeUnrated] = useState(true);
  const [topN, setTopN] = useState(5);
  const [additionalPreferences, setAdditionalPreferences] = useState("");

  const budgetLabels = ["💸 Budget Friendly", "💰 Moderate", "💎 Fine Dining"];
  const budgetValues = ["low", "medium", "high"];

  useEffect(() => {
    // Hardcoded data to ensure dropdowns always work
    const hardcodedData = {
      locations: [
        "BTM Layout", "Koramangala", "Indiranagar", "Jayanagar", 
        "Whitefield", "HSR Layout", "Marathahalli", "Electronic City",
        "Bannerghatta Road", "MG Road", "Brigade Road", "Church Street"
      ],
      cuisines: [
        "Chinese", "Italian", "Indian", "Mexican", "Thai", "Japanese",
        "Continental", "South Indian", "North Indian", "Mughlai",
        "Cafe", "Fast Food", "Biryani", "Pizza", "Burger", "Desserts"
      ]
    };
    
    setLocations(hardcodedData.locations);
    setCuisines(hardcodedData.cuisines);
    
    // Also try to load from API as backup
    const loadMetadata = async () => {
      try {
        const response = await fetch("/api/metadata");
        if (response.ok) {
          const data: MetadataResponse = await response.json();
          // Only use API data if fallback header is not present
          if (!response.headers.get('X-Fallback-Data')) {
            setLocations(data.locations || hardcodedData.locations);
            setCuisines(data.cuisines || hardcodedData.cuisines);
          }
        }
      } catch (error) {
        console.log("Using hardcoded data - API failed");
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
          budget: budgetValues[budget],
          minimum_rating: Number(minimumRating),
          include_unrated: includeUnrated,
          top_n: Number(topN),
          additional_preferences: additionalPreferences.trim() || undefined
        })
      });
      
      if (!response.ok) {
        throw new Error("Recommendations API request failed.");
      }
      
      const data: RecommendationsResponse = await response.json();
      setSummary(data.summary || "");
      setResults(data.recommendations || []);
    } catch (error) {
      console.error("Recommendations error:", error);
      setError("Could not fetch recommendations. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #fecfef 75%, #fecfef 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Hero Section */}
      <div style={{
        padding: '4rem 2rem',
        textAlign: 'center',
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.3)',
          zIndex: 1
        }} />
        <div style={{ position: 'relative', zIndex: 2, maxWidth: '800px', margin: '0 auto' }}>
          <h1 style={{ 
            fontSize: '4rem', 
            fontWeight: '800', 
            marginBottom: '1rem',
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)',
            background: 'linear-gradient(45deg, #fff, #ffd89b)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            🍽️ Palate
          </h1>
          <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem', opacity: 0.95 }}>
            Discover Your Perfect Dining Experience
          </p>
          <p style={{ fontSize: '1.1rem', opacity: 0.9 }}>
            AI-Powered Restaurant Recommendations Tailored Just for You
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem 4rem' }}>
        {/* Form Card */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          padding: '3rem',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          marginTop: '-3rem',
          position: 'relative',
          zIndex: 10
        }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: '700', marginBottom: '1rem', color: '#1a202c' }}>
            Find Your Perfect Restaurant
          </h2>
          <p style={{ color: '#718096', marginBottom: '2rem', fontSize: '1.1rem' }}>
            Tell us your preferences and let our AI recommend the best dining spots
          </p>
          
          <form onSubmit={onSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
              {/* Location */}
              <div>
                <label style={{ 
                  display: 'block', 
                  fontWeight: '600', 
                  marginBottom: '0.5rem', 
                  color: '#4a5568',
                  fontSize: '0.9rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  📍 Location
                </label>
                <select 
                  value={location} 
                  onChange={(e) => setLocation(e.target.value)} 
                  required
                  style={{
                    width: '100%',
                    padding: '1rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '12px',
                    fontSize: '1rem',
                    background: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#667eea';
                    e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <option value="">Select a location</option>
                  {locations.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Cuisine */}
              <div>
                <label style={{ 
                  display: 'block', 
                  fontWeight: '600', 
                  marginBottom: '0.5rem', 
                  color: '#4a5568',
                  fontSize: '0.9rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  🍜 Cuisine
                </label>
                <select 
                  value={cuisine} 
                  onChange={(e) => setCuisine(e.target.value)} 
                  required
                  style={{
                    width: '100%',
                    padding: '1rem',
                    border: '2px solid #e2e8f0',
                    borderRadius: '12px',
                    fontSize: '1rem',
                    background: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#667eea';
                    e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e2e8f0';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <option value="">Select a cuisine</option>
                  {cuisines.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Budget Slider */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ 
                display: 'block', 
                fontWeight: '600', 
                marginBottom: '1rem', 
                color: '#4a5568',
                fontSize: '0.9rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                💰 Budget: <span style={{ color: '#667eea', fontSize: '1.1rem' }}>{budgetLabels[budget]}</span>
              </label>
              <div style={{ position: 'relative', padding: '0 1rem' }}>
                <input
                  type="range"
                  min="0"
                  max="2"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  style={{
                    width: '100%',
                    height: '8px',
                    borderRadius: '4px',
                    background: '#e2e8f0',
                    outline: 'none',
                    WebkitAppearance: 'none',
                    cursor: 'pointer'
                  }}
                />
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '0',
                  right: '0',
                  height: '8px',
                  borderRadius: '4px',
                  background: 'linear-gradient(90deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  width: `${(budget / 2) * 100}%`
                }} />
                <style jsx>{`
                  input[type="range"]::-webkit-slider-thumb {
                    appearance: none;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    cursor: pointer;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                    transition: all 0.2s ease;
                  }
                  input[type="range"]::-webkit-slider-thumb:hover {
                    transform: scale(1.2);
                    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
                  }
                  input[type="range"]::-moz-range-thumb {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    cursor: pointer;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                    transition: all 0.2s ease;
                    border: none;
                  }
                  input[type="range"]::-moz-range-thumb:hover {
                    transform: scale(1.2);
                    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
                  }
                `}</style>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.8rem', color: '#718096' }}>
                <span>Budget</span>
                <span>Moderate</span>
                <span>Premium</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
              {/* Rating */}
              <div>
                <label style={{ 
                  display: 'block', 
                  fontWeight: '600', 
                  marginBottom: '0.5rem', 
                  color: '#4a5568',
                  fontSize: '0.9rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  ⭐ Minimum Rating
                </label>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  value={minimumRating}
                  onChange={(e) => setMinimumRating(Number(e.target.value))}
                  style={{
                    width: '100%',
                    height: '8px',
                    borderRadius: '4px',
                    background: '#e2e8f0',
                    outline: 'none',
                    WebkitAppearance: 'none',
                    cursor: 'pointer'
                  }}
                />
                <div style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '1.1rem', fontWeight: '600', color: '#667eea' }}>
                  {minimumRating.toFixed(1)} / 5.0
                </div>
              </div>
              
              {/* Number of Recommendations */}
              <div>
                <label style={{ 
                  display: 'block', 
                  fontWeight: '600', 
                  marginBottom: '0.5rem', 
                  color: '#4a5568',
                  fontSize: '0.9rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  🔢 Number of Results
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={topN}
                  onChange={(e) => setTopN(Number(e.target.value))}
                  style={{
                    width: '100%',
                    height: '8px',
                    borderRadius: '4px',
                    background: '#e2e8f0',
                    outline: 'none',
                    WebkitAppearance: 'none',
                    cursor: 'pointer'
                  }}
                />
                <div style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '1.1rem', fontWeight: '600', color: '#667eea' }}>
                  {topN} restaurants
                </div>
              </div>
            </div>

            {/* Additional Preferences */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ 
                display: 'block', 
                fontWeight: '600', 
                marginBottom: '0.5rem', 
                color: '#4a5568',
                fontSize: '0.9rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                💭 Additional Preferences
              </label>
              <textarea
                value={additionalPreferences}
                onChange={(e) => setAdditionalPreferences(e.target.value)}
                placeholder="E.g., outdoor seating, vegetarian options, quiet atmosphere, romantic ambiance..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '1rem',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#667eea';
                  e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Submit Button */}
            <div style={{ textAlign: 'center' }}>
              <button 
                type="submit" 
                disabled={loading}
                style={{
                  background: loading 
                    ? '#cbd5e0' 
                    : 'linear-gradient(135deg, #667eea, #764ba2)',
                  color: 'white',
                  fontWeight: '700',
                  padding: '1.25rem 3rem',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '1.1rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: loading ? 'none' : '0 10px 25px rgba(102, 126, 234, 0.3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseOver={(e) => {
                  if (!loading) {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 15px 35px rgba(102, 126, 234, 0.4)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!loading) {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 10px 25px rgba(102, 126, 234, 0.3)';
                  }
                }}
              >
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <span style={{
                      display: 'inline-block',
                      width: '20px',
                      height: '20px',
                      border: '3px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '50%',
                      borderTopColor: 'white',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Finding Perfect Matches...
                  </span>
                ) : (
                  "🔍 Get Recommendations"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            background: 'linear-gradient(135deg, #fed7d7, #feb2b2)',
            border: '1px solid #fc8181',
            color: '#742a2a',
            padding: '1.5rem',
            borderRadius: '12px',
            margin: '2rem 0',
            fontWeight: '500',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(252, 129, 129, 0.2)'
          }}>
            ⚠️ {error}
          </div>
        )}
        
        {/* Loading Message */}
        {loading && (
          <div style={{
            background: 'linear-gradient(135deg, #fef5e7, #fed7aa)',
            border: '1px solid #f6ad55',
            color: '#744210',
            padding: '1.5rem',
            borderRadius: '12px',
            margin: '2rem 0',
            fontWeight: '500',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(246, 173, 85, 0.2)'
          }}>
            <span style={{
              display: 'inline-block',
              width: '20px',
              height: '20px',
              border: '3px solid rgba(116, 66, 16, 0.3)',
              borderRadius: '50%',
              borderTopColor: '#744210',
              animation: 'spin 1s linear infinite',
              marginRight: '0.5rem'
            }} />
            Our AI is analyzing your preferences and finding the best restaurants...
          </div>
        )}

        {/* Results Section */}
        {results.length > 0 && (
          <div style={{ marginTop: '3rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
              <h2 style={{ fontSize: '2.5rem', fontWeight: '700', marginBottom: '1rem', color: 'white' }}>
                🍽️ Recommended Restaurants
              </h2>
              <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '1.2rem' }}>
                {summary || "Here are your personalized recommendations"}
              </p>
            </div>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', 
              gap: '2rem' 
            }}>
              {results.map((rec, index) => (
                <div key={`${rec.name}-${rec.location}-${index}`} style={{
                  background: 'white',
                  borderRadius: '20px',
                  padding: '2rem',
                  boxShadow: '0 15px 35px rgba(0, 0, 0, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px)';
                  e.currentTarget.style.boxShadow = '0 25px 50px rgba(0, 0, 0, 0.15)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 15px 35px rgba(0, 0, 0, 0.1)';
                }}>
                  {/* Gradient accent */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '6px',
                    background: 'linear-gradient(90deg, #667eea, #764ba2, #f093fb)'
                  }} />
                  
                  <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem', color: '#1a202c' }}>
                    {rec.name}
                  </h3>
                  <div style={{ color: '#718096', fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    📍 {rec.location}
                  </div>
                  <div style={{ color: '#4a5568', fontSize: '0.95rem', marginBottom: '1.5rem', fontStyle: 'italic' }}>
                    🍽️ {(rec.cuisines || []).join(" • ")}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                      <span style={{ color: '#f6ad55', fontSize: '1.2rem' }}>⭐</span>
                      <span style={{ fontWeight: '600', color: '#f6ad55' }}>
                        {rec.rating ? `${rec.rating}/5` : "Not Rated"}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                      <span style={{ color: '#48bb78', fontSize: '1.2rem' }}>💰</span>
                      <span style={{ fontWeight: '600', color: '#48bb78' }}>
                        {rec.estimated_cost != null ? `${rec.currency || "₹"}${rec.estimated_cost} for two` : "Price not available"}
                      </span>
                    </div>
                  </div>
                  
                  {rec.why && (
                    <div style={{
                      background: 'linear-gradient(135deg, #fef5e7, #fed7aa)',
                      borderLeft: '4px solid #f6ad55',
                      padding: '1rem',
                      borderRadius: '0 8px 8px 0',
                      fontSize: '0.9rem',
                      color: '#744210',
                      marginTop: '1rem'
                    }}>
                      <strong>💡 Why we recommend:</strong> {rec.why}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      </div>
  );
}
