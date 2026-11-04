import { NextResponse, type NextRequest } from "next/server";
import { allowRequest } from "@/lib/rate-limit";
import { StatusRequestSchema } from "@/lib/ai/schemas";
import { explainStatus } from "@/lib/ai/status-service";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/ai/status
 * Body: { snapshot }
 * Returns: { data: { explanation }, mode: "openai" | "fallback" }
 */
export async function POST(request: NextRequest) {
  if (!await allowRequest(request, "status", 20)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  let bodyJson: unknown;
  try {
    bodyJson = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = StatusRequestSchema.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { data, mode } = await explainStatus(parsed.data.snapshot);
  return NextResponse.json({ data, mode });
}

export function GET() {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405 });
}
