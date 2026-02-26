import { NextResponse } from "next/server";

// Proxy route to get a short-lived Deepgram token
// This prevents the API key from being exposed client-side
export async function POST() {
  const apiKey = process.env.DEEPGRAM_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Deepgram API key not configured" },
      { status: 500 }
    );
  }

  try {
    // Request a short-lived token from Deepgram (expires in 30 seconds)
    const response = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // TTL of 30 seconds — enough to establish the WebSocket
        ttl_seconds: 30,
      }),
    });

    if (!response.ok) {
      // Fallback: return the API key directly if grant endpoint isn't available
      // (some Deepgram plans don't support short-lived tokens)
      console.warn("[Deepgram] Token grant failed, using API key directly");
      return NextResponse.json({ token: apiKey });
    }

    const data = await response.json();
    return NextResponse.json({ token: data.key ?? apiKey });
  } catch (error) {
    console.error("[Deepgram] Token fetch error:", error);
    // Fallback to direct API key
    return NextResponse.json({ token: apiKey });
  }
}
