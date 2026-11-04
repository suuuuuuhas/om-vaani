import type { Locale, SystemId } from "@/lib/types";

/** Localized deterministic summaries for fallback triage. */
const SUMMARY_TEMPLATES: Record<SystemId, Record<Locale, (topic: string) => string>> = {
  nch: {
    en: (t) =>
      `This looks like a consumer grievance${t}. It fits the National Consumer Helpline route.`,
    hi: (t) =>
      `यह एक उपभोक्ता शिकायत लगती है${t}. यह राष्ट्रीय उपभोक्ता हेल्पलाइन मार्ग के अंतर्गत आती है।`,
    te: (t) =>
      `ఇది వినియోగదారు ఫిర్యాదుగా అనిపిస్తుంది${t}. ఇది జాతీయ వినియోగదారుల హెల్ప్‌లైన్ మార్గానికి చెందుతుంది.`
  },
  epfo: {
    en: (t) =>
      `This looks like a provident-fund issue${t}. It fits the EPFO grievance route.`,
    hi: (t) =>
      `यह भविष्य निधि से जुड़ा मामला लगता है${t}. यह EPFO शिकायत मार्ग के अंतर्गत आता है।`,
    te: (t) =>
      `ఇది ప్రావిడెంట్ ఫండ్ సమస్యగా అనిపిస్తుంది${t}. ఇది EPFO ఫిర్యాదు మార్గానికి చెందుతుంది.`
  },
  railways: {
    en: (t) =>
      `This looks like a railway grievance${t}. It fits the RailMadad or IRCTC TDR route.`,
    hi: (t) =>
      `यह रेलवे से जुड़ी शिकायत लगती है${t}. यह RailMadad या IRCTC TDR मार्ग के अंतर्गत आती है।`,
    te: (t) =>
      `ఇది రైల్వే ఫిర్యాదుగా అనిపిస్తుంది${t}. ఇది RailMadad లేదా IRCTC TDR మార్గానికి చెందుతుంది.`
  }
};

export function fallbackSummary(
  system: SystemId,
  locale: Locale,
  topic: string
): string {
  const template =
    SUMMARY_TEMPLATES[system]?.[locale] ?? SUMMARY_TEMPLATES[system].en;
  return template(topic);
}

export function topicPhrase(extracted: Record<string, string>): string {
  if (extracted.orderNumber) return ` about order ${extracted.orderNumber}`;
  if (extracted.pnr) return ` about PNR ${extracted.pnr}`;
  if (extracted.claimId || extracted.uan)
    return ` about claim ${extracted.claimId ?? extracted.uan}`;
  return "";
}

const URGENT_WORDS =
  /(urgent|immediately|asap|emergency|तत्काल|जरूरी|अभी|అత్యవసర|వెంటనే)/i;

export function fallbackUrgency(text: string): "low" | "medium" | "high" {
  if (URGENT_WORDS.test(text)) return "high";
  const amount = text.match(/(?:₹|\brs\.?\b|रु)\s*([\d,]+)/i);
  if (amount && parseInt(amount[1].replace(/,/g, ""), 10) >= 5000) return "medium";
  return "low";
}

export function fallbackConfidence(score: number): number {
  if (score <= 0) return 0.25;
  if (score === 1) return 0.55;
  if (score === 2) return 0.7;
  return Math.min(0.92, 0.7 + score * 0.05);
}

export function fallbackDisclaimer(locale: Locale): string {
  switch (locale) {
    case "hi":
      return "प्रोटोटाइप मार्गदर्शन - कानूनी सलाह नहीं। आगे बढ़ने से पहले विवरण जाँचें।";
    case "te":
      return "ప్రోటోటైప్ మార్గదర్శకం - చట్టపరమైన సలహా కాదు. ముందుకు సాగే ముందు వివరాలు సరిచూసుకోండి.";
    default:
      return "Prototype guidance only - not legal advice. Verify details before acting.";
  }
}
