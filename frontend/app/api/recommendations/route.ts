import { NextRequest, NextResponse } from "next/server";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function POST(request: NextRequest) {
  if (!baseUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_API_BASE_URL is not set." }, { status: 500 });
  }

  const payload = await request.json();
  const search = new URLSearchParams({ endpoint: "recommendations" });
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });

  const response = await fetch(`${baseUrl}/?${search.toString()}`, { cache: "no-store" });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
