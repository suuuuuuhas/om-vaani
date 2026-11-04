import type { CaseSnapshot } from "@/lib/ai/schemas";
import { daysBetween } from "@/lib/utils/dates";

/**
 * Deterministic status explanations. Isomorphic - safe to import from
 * browser components without pulling in the OpenAI SDK.
 */

type StatusKey = CaseSnapshot["statusCode"];

const STATUS_PHRASES: Record<StatusKey, Record<string, string>> = {
  submitted: {
    en: "has just been submitted and is awaiting acknowledgement",
    hi: "अभी जमा हुआ है और पावती की प्रतीक्षा में है",
    te: "ఇప్పుడే సమర్పించబడింది, అంగీకారం కోసం వేచి ఉంది"
  },
  "in-progress": {
    en: "has been acknowledged and is marked in progress",
    hi: "पावती मिल चुकी है और मामला प्रगति पर चिह्नित है",
    te: "అంగీకరించబడి, పురోగతిలో ఉందని గుర్తించబడింది"
  },
  "awaiting-response": {
    en: "is waiting for a response from the system",
    hi: "संबंधित प्रणाली से जवाब की प्रतीक्षा कर रहा है",
    te: "సంబంధిత వ్యవస్థ నుండి స్పందన కోసం వేచి ఉంది"
  },
  "response-received": {
    en: "has received an official response",
    hi: "को आधिकारिक जवाब मिल चुका है",
    te: "అధికారిక స్పందన అందింది"
  },
  "closed-unsatisfactory": {
    en: "was closed without a satisfactory resolution",
    hi: "संतोषजनक समाधान के बिना बंद हो गया",
    te: "తృప్తికరమైన పరిష్కారం లేకుండా మూసివేయబడింది"
  }
};

export function fallbackExplanation(snapshot: CaseSnapshot): string {
  const days = daysBetween(new Date(snapshot.createdAt), new Date());
  const phrase =
    STATUS_PHRASES[snapshot.statusCode][snapshot.locale] ??
    STATUS_PHRASES[snapshot.statusCode].en;
  const ref = snapshot.referenceNumber ?? snapshot.id;

  switch (snapshot.locale) {
    case "hi":
      return `मामला ${ref} ${phrase}। यह ${days} दिनों से खुला है; संबंधित प्रणाली से लगभग ${snapshot.expectedResponseDays} दिनों में जवाब की आम अपेक्षा होती है। यह एक काल्पनिक प्रदर्शन मामला है - समय-सीमाएँ सुझाव हैं, अधिकार नहीं।`;
    case "te":
      return `కేసు ${ref} ${phrase}. ఇది ${days} రోజులుగా తెరిచి ఉంది; సంబంధిత వ్యవస్థ సుమారు ${snapshot.expectedResponseDays} రోజుల్లో స్పందిస్తుందని సాధారణంగా ఆశిస్తారు. ఇది ఒక కల్పిత ప్రదర్శన కేసు - గడువులు సూచనలే, హక్కులు కావు.`;
    default:
      return `Case ${ref} ${phrase}. It has been open for ${days} day(s); the responsible system is commonly expected to respond within about ${snapshot.expectedResponseDays} days. This is a synthetic demonstration case - timelines are suggestions, not entitlements.`;
  }
}
