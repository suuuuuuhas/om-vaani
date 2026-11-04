import { NextResponse, type NextRequest } from "next/server";
import { allowRequest } from "@/lib/rate-limit";
import { EscalationRequestSchema } from "@/lib/ai/schemas";
import { draftEscalationLetter } from "@/lib/ai/escalation-service";
import { getAdapter } from "@/lib/adapters";
import { getDictionary, lookupMessage } from "@/lib/i18n";
import { checkSensitiveContent } from "@/lib/privacy/guard";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/ai/escalation
 * Body: { snapshot, addressedTo, facts, locale, regenerate }
 * Returns: { data: { subject, body }, mode: "openai" | "fallback" }
 */
export async function POST(request: NextRequest) {
  if (!await allowRequest(request, "escalation", 20)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  let bodyJson: unknown;
  try {
    bodyJson = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = EscalationRequestSchema.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { snapshot, addressedTo, facts, locale, regenerate } = parsed.data;

  // Privacy gate on every free-text field of the snapshot.
  const textsToCheck = [
    snapshot.originalText,
    ...Object.values(snapshot.fields),
    addressedTo
  ];
  for (const t of textsToCheck) {
    const guard = checkSensitiveContent(t);
    if (!guard.ok) {
      return NextResponse.json(
        { error: "privacy_blocked", findings: guard.findings },
        { status: 422 }
      );
    }
  }

  const adapter = getAdapter(snapshot.system);
  const dict = getDictionary(locale);

  const factLines = facts.map((f) => ({
    label:
      lookupMessage(dict, f.labelKey) ??
      lookupMessage(getDictionary("en"), f.labelKey) ??
      f.labelKey,
    value: f.value
  }));

  const { data, mode } = await draftEscalationLetter({
    snapshot,
    addressedTo,
    factLines,
    sourceUrl: adapter.policy.sourceUrl,
    regenerate
  });

  return NextResponse.json({ data, mode });
}

export function GET() {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
