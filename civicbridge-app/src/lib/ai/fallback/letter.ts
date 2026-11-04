import type { CaseSnapshot } from "@/lib/ai/schemas";

/**
 * Isomorphic deterministic escalation-letter builder. Lives apart from the
 * OpenAI client so browser code can use it without bundling server SDKs.
 */
export interface LocalLetterInput {
  snapshot: CaseSnapshot;
  addressedTo: string;
  factLines: Array<{ label: string; value: string }>;
  sourceUrl: string;
}

const REQUEST_PHRASES: Record<CaseSnapshot["system"], Record<string, string>> = {
  nch: {
    en: "a resolution of this complaint, or a clear written explanation if it cannot be resolved at this level",
    hi: "इस शिकायत का समाधान, या यदि इस स्तर पर समाधान संभव नहीं है तो स्पष्ट लिखित विवरण",
    te: "ఈ ఫిర్యాదుకు పరిష్కారం, లేదా ఈ స్థాయిలో సాధ్యం కాకపోతే స్పష్టమైన లిఖిత వివరణ"
  },
  epfo: {
    en: "processing of the pending claim and a written status update",
    hi: "लंबित दावे की प्रक्रिया और लिखित स्थिति अपडेट",
    te: "పెండింగ్ క్లెయిమ్ ప్రాసెసింగ్, లిఖిత స్థితి నవీకరణ"
  },
  railways: {
    en: "re-examination of this complaint and a clear written response",
    hi: "इस शिकायत की पुनः समीक्षा और स्पष्ट लिखित जवाब",
    te: "ఈ ఫిర్యాదు పునఃపరిశీలన, స్పష్టమైన లిఖిత స్పందన"
  }
};

const GREETING: Record<string, string> = {
  en: "Respected Sir or Madam,",
  hi: "महोदय/महोदया,",
  te: "గౌరవనీయులైన అధికారి,"
};

const SIGNOFF: Record<string, string> = {
  en: "Sincerely,\n(Your name)\n\nPrepared with CivicBridge - an independent hackathon prototype. Details above are self-reported; reference data in this prototype is synthetic.",
  hi: "सादर,\n(आपका नाम)\n\nCivicBridge - एक स्वतंत्र हैकाथॉन प्रोटोटाइप - द्वारा तैयार। ऊपर दिए विवरण स्वयं-घोषित हैं; इस प्रोटोटाइप का संदर्भ डेटा काल्पनिक है।",
  te: "వినమ్రం,\n(మీ పేరు)\n\nCivicBridge - ఒక స్వతంత్ర హ్యాకథాన్ ప్రోటోటైప్ - ద్వారా సిద్ధం. పై వివరాలు స్వయం-ప్రకటితం; ఈ ప్రోటోటైప్ రిఫరెన్స్ డేటా కల్పితం."
};

export function localSubject(snapshot: CaseSnapshot): string {
  switch (snapshot.system) {
    case "nch":
      return `Unresolved consumer grievance - case ${snapshot.id}`;
    case "epfo":
      return `Pending EPF claim follow-up - case ${snapshot.id}`;
    case "railways":
      return snapshot.railwaySubflow === "tdr"
        ? `TDR refund follow-up for PNR ${snapshot.fields.pnr ?? "-"} (case ${snapshot.id})`
        : `Re-examination request for RailMadad complaint ${snapshot.referenceNumber ?? snapshot.id}`;
  }
}

export function buildLocalFallbackLetter(
  input: LocalLetterInput,
  locale: CaseSnapshot["locale"]
): { subject: string; body: string } {
  const { snapshot } = input;
  const createdDate = new Date(snapshot.createdAt).toLocaleDateString(
    locale === "hi" ? "hi-IN" : locale === "te" ? "te-IN" : "en-IN"
  );
  const daysOpen = Math.max(
    0,
    Math.floor((Date.now() - new Date(snapshot.createdAt).getTime()) / 86_400_000)
  );

  const factBlock =
    input.factLines.length > 0
      ? input.factLines.map((f) => `- ${f.label}: ${f.value}`).join("\n")
      : Object.entries(snapshot.fields)
          .filter(([, v]) => v && v.trim())
          .map(([k, v]) => `- ${k}: ${v}`)
          .join("\n");

  const request =
    REQUEST_PHRASES[snapshot.system][locale] ?? REQUEST_PHRASES[snapshot.system].en;

  const statusLine: Record<string, string> = {
    en: `The case has been open for ${daysOpen} day(s) since ${createdDate} and its current recorded status is "${snapshot.statusCode}".`,
    hi: `यह मामला ${createdDate} से ${daysOpen} दिनों से खुला है और दर्ज वर्तमान स्थिति "${snapshot.statusCode}" है।`,
    te: `ఈ కేసు ${createdDate} నుండి ${daysOpen} రోజులుగా తెరిచి ఉంది; నమోదైన ప్రస్తుత స్థితి "${snapshot.statusCode}".`
  };

  const introLine: Record<string, string> = {
    en: "I wish to bring the following grievance to your attention:",
    hi: "मैं निम्नलिखित शिकायत आपके ध्यान में लाना चाहता/चाहती हूँ:",
    te: "నేను ఈ క్రింది ఫిర్యాదును మీ దృష్టికి తీసుకురావాలనుకుంటున్నాను:"
  };
  const factsHeading: Record<string, string> = {
    en: "Case details:",
    hi: "मामले का विवरण:",
    te: "కేసు వివరాలు:"
  };
  const requestLine: Record<string, string> = {
    en: `I respectfully request ${request}.`,
    hi: `कृपया ${request}।`,
    te: `దయచేసి ${request} అభ్యర్థిస్తున్నాను.`
  };

  const body = [
    input.addressedTo,
    "",
    `Subject: ${localSubject(snapshot)}`,
    "",
    GREETING[locale] ?? GREETING.en,
    "",
    introLine[locale] ?? introLine.en,
    "",
    `"${snapshot.originalText.slice(0, 600)}${snapshot.originalText.length > 600 ? "…" : ""}"`,
    "",
    factsHeading[locale] ?? factsHeading.en,
    factBlock || "- (no reference fields captured)",
    "",
    statusLine[locale] ?? statusLine.en,
    "",
    requestLine[locale] ?? requestLine.en,
    "",
    SIGNOFF[locale] ?? SIGNOFF.en,
    "",
    `Reference guidance source: ${input.sourceUrl}`
  ].join("\n");

  return {
    subject: localSubject(snapshot).slice(0, 200),
    body: body.slice(0, 6000)
  };
}
