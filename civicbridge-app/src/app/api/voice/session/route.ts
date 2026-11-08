import { upgradeWebSocket } from "@vercel/functions";
import type { NextRequest } from "next/server";
import { allowRequest } from "@/lib/rate-limit";
import { startVoiceSession } from "@/lib/voice/stream-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return new Response("Forbidden", { status: 403 });
  try { if (new URL(origin).host !== host) return new Response("Forbidden", { status: 403 }); }
  catch { return new Response("Forbidden", { status: 403 }); }
  if (!await allowRequest(request, "voice-session", 6)) return new Response("Temporarily unavailable", { status: 429 });
  if (!process.env.GNANI_STT_API_KEY || !process.env.GNANI_TTS_API_KEY || !process.env.GEMINI_API_KEY) return new Response("Voice service is not configured", { status: 503 });
  return upgradeWebSocket(ws => startVoiceSession(ws), { maxPayload: 16384 });
}
