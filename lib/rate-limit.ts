import { NextResponse } from "next/server";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_AI_REQUESTS_PER_WINDOW = 30;

const hits = new Map<string, number[]>();

export function checkRateLimit(userId: string): NextResponse | null {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_AI_REQUESTS_PER_WINDOW) {
    hits.set(userId, recent);
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  recent.push(now);
  hits.set(userId, recent);
  return null;
}
