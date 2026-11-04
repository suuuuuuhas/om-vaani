import type { Locale, TriageResult } from "@/lib/types";
import { getAdapter } from "@/lib/adapters";
import {
  extractFieldsDeterministic,
  missingFields
} from "./extraction";
import {
  fallbackConfidence,
  fallbackDisclaimer,
  fallbackSummary,
  topicPhrase,
  fallbackUrgency
} from "./templates";
import { scoreSystems } from "./keywords";

/**
 * Deterministic triage used when AI is unavailable. Isomorphic: imported by
 * both the server service and the browser intake (which never bundles the
 * OpenAI SDK).
 */
export function fallbackTriage(text: string, locale: Locale): TriageResult {
  const { scores, winner, railwaySubflow } = scoreSystems(text);
  const extracted = extractFieldsDeterministic(text);
  const adapterFieldKeys = getAdapter(winner).fieldKeys;
  const missing = missingFields(adapterFieldKeys.slice(0, 4), extracted);
  const score = scores[winner];

  return {
    system: winner,
    railwaySubflow,
    summary: fallbackSummary(winner, locale, topicPhrase(extracted)),
    extractedFields: extracted,
    missingFields:
      score > 0 && missing.length > 0
        ? missing
        : adapterFieldKeys.slice(0, 3),
    confidence: fallbackConfidence(score),
    urgency: fallbackUrgency(text),
    disclaimer: fallbackDisclaimer(locale)
  };
}
