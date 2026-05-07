import { NextRequest, NextResponse } from "next/server";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function POST(request: NextRequest) {
  if (!baseUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_API_BASE_URL is not set." }, { status: 500 });
  }

  try {
    const payload = await request.json();
    const search = new URLSearchParams({ endpoint: "recommendations" });
    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      search.set(key, String(value));
    });

    const response = await fetch(`${baseUrl}/?${search.toString()}`, { 
      cache: "no-store",
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Palate-Frontend/1.0)',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    });

    // Handle authentication redirect
    if (response.status === 302 || response.redirected) {
      const redirectUrl = response.url;
      // Try again with the redirect URL
      const retryResponse = await fetch(`${redirectUrl}&${search.toString()}`, {
        cache: "no-store",
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Palate-Frontend/1.0)',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      });
      
      if (retryResponse.ok) {
        const data = await retryResponse.json();
        return NextResponse.json(data, { status: retryResponse.status });
      }
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Recommendations API error:", error);
    
    // Fallback with demo recommendations if API fails
    const fallbackData = {
      summary: "Demo recommendations - API connection failed",
      recommendations: [
        {
          name: "Demo Restaurant 1",
          location: "BTM",
          cuisines: ["Chinese", "Asian"],
          rating: 4.2,
          estimated_cost: 800,
          currency: "₹",
          why: "This is a demo recommendation due to API connection issues."
        },
        {
          name: "Demo Restaurant 2", 
          location: "Koramangala",
          cuisines: ["Italian", "Continental"],
          rating: 4.5,
          estimated_cost: 1200,
          currency: "₹",
          why: "This is a demo recommendation due to API connection issues."
        }
      ]
    };
    
    return NextResponse.json(fallbackData, { 
      status: 200,
      headers: {
        'X-Fallback-Data': 'true'
      }
    });
  }
}
