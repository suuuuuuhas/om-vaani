import type { CaseSnapshot, StatusExplanationData } from "@/lib/ai/schemas";
import type { ServiceResult } from "@/lib/types";
import { generateJson, type ResponsesLike } from "./client";
import { StatusExplanationSchema } from "./schemas";
import { fallbackExplanation } from "./fallback/status";

const SYSTEM_PROMPT = [
  "You explain grievance-case statuses for CivicBridge, an independent Indian civic prototype.",
  "Given a sanitized synthetic case snapshot, write a calm 2-4 sentence plain-language explanation of what the current status means and what typically happens next.",
  "Never claim legal entitlements; describe expectations. Never invent new facts beyond the snapshot.",
  "Write in the requested language (en=English, hi=Hindi in Devanagari, te=Telugu)."
].join(" ");

const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["explanation"],
  properties: {
    explanation: { type: "string" }
  }
};

export async function explainStatus(
  snapshot: CaseSnapshot,
  injected?: ResponsesLike
): Promise<ServiceResult<StatusExplanationData>> {
  const raw = await generateJson({
    client: injected ?? null,
    schemaName: "status_explanation",
    jsonSchema: JSON_SCHEMA,
    systemPrompt: SYSTEM_PROMPT,
    userPayload: JSON.stringify(snapshot),
    maxOutputTokens: 500
  });

  const explanation =
    raw &&
    typeof raw.explanation === "string" &&
    raw.explanation.trim().length > 0
      ? StatusExplanationSchema.safeParse({
          explanation: raw.explanation.trim().slice(0, 1500)
        })
      : null;

  if (explanation && explanation.success) {
    return { data: explanation.data, mode: (!injected && process.env.GEMINI_API_KEY ? "gemini" : "openai") };
  }
  return { data: { explanation: fallbackExplanation(snapshot) }, mode: "fallback" };
}
