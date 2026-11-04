import { NextResponse } from "next/server";
import { checkSensitiveContent } from "@/lib/privacy/guard";
import { allowRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;
const languages = new Set(["en-IN", "hi-IN", "te-IN", "ta-IN", "kn-IN", "ml-IN", "mr-IN", "bn-IN", "gu-IN", "pa-IN"]);

export async function POST(request: Request) {
  if (!await allowRequest(request, "speak", 12)) return NextResponse.json({ error: "Too many requests or service temporarily unavailable." }, { status: 429 });
  const key = process.env.GNANI_TTS_API_KEY || process.env.GNANI_API_KEY;
  if (!key) return NextResponse.json({ error: "Voice playback is not configured." }, { status: 503 });
  try {
    const { text, language } = await request.json();
    if (typeof text !== "string" || !text.trim() || text.length > 1500 || !languages.has(language) || !checkSensitiveContent(text).ok) {
      return NextResponse.json({ error: "This text cannot be read aloud." }, { status: 400 });
    }
    const body = JSON.stringify({ text, language, model: "timbre-v3.0", voice: "Shivani",
      audio_config: { container: "ogg", sample_rate: 48000, num_channels: 1 } });
    const send = () => fetch("https://api.vachana.ai/api/v1/tts/inference", {
      method: "POST", headers: { "X-API-Key-ID": key, "Content-Type": "application/json" },
      body, signal: AbortSignal.timeout(25000)
    });
    let response = await send();
    if ([429, 502, 503, 504].includes(response.status)) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      response = await send();
    }
    if (!response.ok) return NextResponse.json({ error: "Voice playback is unavailable. Please try again." }, { status: 502 });
    const audio = await response.arrayBuffer();
    if (audio.byteLength < 4 || new TextDecoder().decode(audio.slice(0, 4)) !== "OggS") throw new Error("invalid audio");
    return new Response(audio, { headers: { "Content-Type": "audio/ogg", "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Voice playback failed. Please try again." }, { status: 502 }); }
}
