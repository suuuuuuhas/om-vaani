import { NextResponse, type NextRequest } from "next/server";
import { TriageRequestSchema } from "@/lib/ai/schemas";
import { triageGrievance } from "@/lib/ai/triage-service";
import { checkSensitiveContent, clampIntakeText } from "@/lib/privacy/guard";
import { allowRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/ai/triage
 * Body: { text, locale }
 * Returns: { data: TriageResult, mode: "openai" | "fallback" }
 * Privacy-blocked input returns 422 with findings; nothing is forwarded to AI.
 */
export async function POST(request: NextRequest) {
  if (!await allowRequest(request, "triage", 20)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  let bodyJson: unknown;
  try {
    bodyJson = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsedBody = TriageRequestSchema.safeParse(bodyJson);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const text = clampIntakeText(parsedBody.data.text);
  if (text.length < 20) {
    return NextResponse.json(
      { error: "text_too_short", minChars: 20 },
      { status: 400 }
    );
  }

  // Server-side privacy gate - mirrors the browser check.
  const guard = checkSensitiveContent(text);
  if (!guard.ok) {
    return NextResponse.json(
      { error: "privacy_blocked", findings: guard.findings },
      { status: 422 }
    );
  }

  const { data, mode } = await triageGrievance(text, parsedBody.data.locale, undefined, parsedBody.data.voiceLanguage);
  return NextResponse.json({ data, mode });
}
