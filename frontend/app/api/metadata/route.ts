import { NextResponse } from "next/server";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function GET() {
  if (!baseUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_API_BASE_URL is not set." }, { status: 500 });
  }

  try {
    const response = await fetch(`${baseUrl}/?endpoint=metadata`, { 
      cache: "no-store",
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Palate-Frontend/1.0)',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    // Handle authentication redirect
    if (response.status === 302 || response.redirected) {
      const redirectUrl = response.url;
      // Try again with the redirect URL
      const retryResponse = await fetch(redirectUrl, {
        cache: "no-store",
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Palate-Frontend/1.0)',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
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
    console.error("Metadata API error:", error);
    
    // Fallback with demo data if API fails
    const fallbackData = {
      locations: ["BTM", "Koramangala", "Indiranagar", "Jayanagar", "Whitefield"],
      cuisines: ["Chinese", "Italian", "Indian", "Mexican", "Thai", "Japanese"]
    };
    
    return NextResponse.json(fallbackData, { 
      status: 200,
      headers: {
        'X-Fallback-Data': 'true'
      }
    });
  }
}
