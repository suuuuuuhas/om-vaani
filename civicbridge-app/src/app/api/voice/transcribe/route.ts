import { NextResponse } from "next/server";
import { allowRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;
const supportedLanguages = new Set(["en-IN", "hi-IN", "te-IN", "ta-IN", "kn-IN", "ml-IN", "mr-IN", "bn-IN", "gu-IN", "pa-IN"]);

export async function POST(request: Request) {
  if (!await allowRequest(request, "transcribe", 12)) return NextResponse.json({ error: "Too many requests or service temporarily unavailable." }, { status: 429 });
  const key = process.env.GNANI_STT_API_KEY || process.env.GNANI_API_KEY;
  if (!key) return NextResponse.json({ error: "Voice recognition is not configured." }, { status: 503 });
  try {
    const input = await request.formData();
    const file = input.get("audio");
    if (!(file instanceof File) || file.size < 100 || file.size > 3 * 1024 * 1024 || file.type !== "audio/wav") {
      return NextResponse.json({ error: "Please record a voice note under 30 seconds." }, { status: 400 });
    }
    const form = new FormData();
    form.append("audio_file", file, "recording.wav");
    form.append("model", "prisma-v3.0");
    form.append("language_code", "indic-auto");
    form.append("format", "transcribe");
    const response = await fetch("https://api.vachana.ai/stt/v3", {
      method: "POST", headers: { "X-API-Key-ID": key }, body: form, signal: AbortSignal.timeout(45000)
    });
    if (!response.ok) return NextResponse.json({ error: "Voice recognition is unavailable. Try again or type your message." }, { status: 502 });
    const data = await response.json();
    if (!data.success || typeof data.transcript !== "string" || !data.transcript.trim() || data.truncated) {
      return NextResponse.json({ error: "We could not recognise the complete recording. Try a shorter note." }, { status: 422 });
    }
    if (data.transcript.length > 4000) return NextResponse.json({ error: "The recording was too long to transcribe safely. Please record a shorter note." }, { status: 422 });
    return NextResponse.json({ transcript: data.transcript, language: supportedLanguages.has(data.detected_language_code) ? data.detected_language_code : null });
  } catch { return NextResponse.json({ error: "Voice recognition failed. Try again or type your message." }, { status: 502 }); }
}
