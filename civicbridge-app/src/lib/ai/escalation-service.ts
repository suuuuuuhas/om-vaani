import type {
  EscalationLetterData
} from "@/lib/ai/schemas";
import type { ServiceResult } from "@/lib/types";
import { generateJson, type ResponsesLike } from "./client";
import { EscalationLetterSchema } from "./schemas";
import { buildLocalFallbackLetter, localSubject, type LocalLetterInput } from "./fallback/letter";

export interface EscalationDraftInput extends LocalLetterInput {
  regenerate?: boolean;
}

const SYSTEM_PROMPT = [
  "You draft polite, factual escalation letters for Civic Sathi, an independent Indian civic prototype.",
  "Use only the sanitized synthetic case snapshot provided. Structure: recipient line, subject line, greeting, short context paragraph, a bulleted detail list, one clear request sentence, and a signature placeholder.",
  "Tone is respectful and firm; no legal threats, no invented facts, no claims of automatic entitlement.",
  "Keep the body under 400 words. Write in the requested language (en=English, hi=Hindi in Devanagari, te=Telugu).",
  'Return {"subject": string, "body": string}.'
].join(" ");

const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "body"],
  properties: {
    subject: { type: "string" },
    body: { type: "string" }
  }
};

/**
 * Escalation drafting service. Returns an editable letter plus execution mode.
 * Deterministic template fallback keeps the journey working without AI.
 */
export async function draftEscalationLetter(
  input: EscalationDraftInput,
  injected?: ResponsesLike
): Promise<ServiceResult<EscalationLetterData>> {
  const raw = (await generateJson({
    client: injected ?? null,
    schemaName: "escalation_letter",
    jsonSchema: JSON_SCHEMA,
    systemPrompt: SYSTEM_PROMPT,
    userPayload: JSON.stringify({
      locale: input.snapshot.locale,
      addressedTo: input.addressedTo,
      facts: input.factLines,
      suggestedSubject: localSubject(input.snapshot),
      snapshot: {
        ...input.snapshot,
        originalText: input.snapshot.originalText.slice(0, 1200)
      }
    }),
    maxOutputTokens: 1400
  })) as { subject?: unknown; body?: unknown } | null;

  if (raw) {
    const subject = typeof raw.subject === "string" ? raw.subject.trim().slice(0, 200) : "";
    const body = typeof raw.body === "string" ? raw.body.trim().slice(0, 6000) : "";
    const parsed = EscalationLetterSchema.safeParse({ subject, body });
    if (parsed.success && body.length > 80) {
      return { data: parsed.data, mode: (!injected && process.env.GEMINI_API_KEY ? "gemini" : "openai") };
    }
  }

  const fallback = buildLocalFallbackLetter(input, input.snapshot.locale);
  return { data: fallback, mode: "fallback" };
}
