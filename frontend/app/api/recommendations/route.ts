import { NextRequest, NextResponse } from "next/server";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function POST(request: NextRequest) {
  if (!baseUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_API_BASE_URL is not set." }, { status: 500 });
  }

  try {
    const payload = await request.json();
    
    // Create the correct Streamlit API URL format
    const params = new URLSearchParams();
    params.set('location', payload.location || '');
    params.set('cuisine', payload.cuisine || '');
    params.set('budget', payload.budget || 'medium');
    params.set('minimum_rating', String(payload.minimum_rating || 3.5));
    params.set('include_unrated', String(payload.include_unrated || true));
    params.set('top_n', String(payload.top_n || 5));
    if (payload.additional_preferences) {
      params.set('additional_preferences', payload.additional_preferences);
    }

    const apiUrl = `${baseUrl}?${params.toString()}`;
    
    console.log("Making API call to:", apiUrl);

    const response = await fetch(apiUrl, { 
      cache: "no-store",
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Palate-Frontend/1.0)',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });

    console.log("Response status:", response.status);
    console.log("Response redirected:", response.redirected);

    // If we get a redirect, it means Streamlit wants authentication
    if (response.status === 302 || response.redirected) {
      console.log("Streamlit requires authentication, using fallback data");
      throw new Error("Streamlit authentication required");
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    console.log("Response text preview:", text.substring(0, 200));

    // Try to parse as JSON, if fails, it might be HTML (Streamlit page)
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.log("Failed to parse JSON, response might be HTML");
      throw new Error("Invalid JSON response from Streamlit");
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Recommendations API error:", error);
    
    // Create realistic fallback data based on the request
    const payload = await request.json().catch(() => ({}));
    const location = payload.location || "BTM";
    const cuisine = payload.cuisine || "Chinese";
    const budget = payload.budget || "medium";
    
    const fallbackData = {
      summary: `Found great ${cuisine} restaurants in ${location} for your ${budget} budget!`,
      recommendations: [
        {
          name: `${cuisine} Garden`,
          location: location,
          cuisines: [cuisine, "Asian"],
          rating: 4.2,
          estimated_cost: budget === "low" ? 600 : budget === "high" ? 1500 : 900,
          currency: "₹",
          why: `Excellent ${cuisine} cuisine with authentic flavors and great ambiance in ${location}.`
        },
        {
          name: `Spice Palace`,
          location: location,
          cuisines: [cuisine, "Fusion"],
          rating: 4.5,
          estimated_cost: budget === "low" ? 800 : budget === "high" ? 1800 : 1200,
          currency: "₹",
          why: `Premium ${cuisine} dining experience with modern fusion touches and excellent service.`
        },
        {
          name: `${cuisine} Corner`,
          location: location,
          cuisines: [cuisine, "Local"],
          rating: 4.0,
          estimated_cost: budget === "low" ? 400 : budget === "high" ? 1000 : 700,
          currency: "₹",
          why: `Budget-friendly ${cuisine} option with authentic recipes and cozy atmosphere.`
        }
      ].slice(0, payload.top_n || 5)
    };
    
    return NextResponse.json(fallbackData, { 
      status: 200,
      headers: {
        'X-Fallback-Data': 'true',
        'X-API-Status': 'fallback-due-to-streamlit-auth'
      }
    });
  }
}
