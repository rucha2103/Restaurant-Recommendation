import { NextResponse } from "next/server";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function GET() {
  if (!baseUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_API_BASE_URL is not set." }, { status: 500 });
  }

  const response = await fetch(`${baseUrl}/?endpoint=metadata`, { cache: "no-store" });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
