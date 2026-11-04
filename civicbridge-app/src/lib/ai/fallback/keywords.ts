import type { Locale, RailwaySubflow, SystemId } from "@/lib/types";

/**
 * Deterministic keyword dictionaries used when AI is unavailable.
 * English, Hindi, and Telugu terms are matched case-insensitively.
 */

type Keywords = Record<Locale | "shared", string[]>;

const CONSUMER_KEYWORDS: Keywords = {
  shared: [
    "refund", "defective", "defect", "warranty", "guarantee", "bill",
    "overcharge", "overcharged", "delivery", "damaged", "broken", "seller",
    "seller refused", "online order", "order number", "e-commerce", "ecommerce",
    "product", "service", "hotel", "restaurant", "shopkart", "amazon", "flipkart",
    "cashback", "emi", "subscription"
  ],
  en: ["consumer", "complaint against company", "money back"],
  hi: [
    "रिफंड", "वापसी", "दोष", "खराब", "टूटा", "क्षतिग्रस्त", "विक्रेता", "बिल",
    "ऑनलाइन ऑर्डर", "ऑर्डर नंबर", "गारंटी", "वारंटी", "उपभोक्ता", "धोखा",
    "पैसे लौटाओ", "मिक्सर", "प्रेशर कुकर"
  ],
  te: [
    "రీఫండ్", "వెనక్కి", "లోపం", "పాడైన", "విరిగిన", "అమ్మకందారు", "బిల్లు",
    "ఆన్‌లైన్ ఆర్డర్", "ఆర్డర్ నంబర్", "వారెంటీ", "గ్యారంటీ", "వినియోగదారు",
    "మోసం", "డబ్బు తిరిగి", "ప్రెషర్ కుకర్"
  ]
};

const EPFO_KEYWORDS: Keywords = {
  shared: [
    "epf", "epfo", "pf ", "provident fund", "uan", "pension", "withdrawal",
    "withdraw", "claim status", "employer contribution", "kyc", "passbook",
    "form 19", "form 10c", "form 31", "establishment id"
  ],
  en: ["pf claim", "pf withdrawal"],
  hi: [
    "भविष्य निधि", "पीएफ", "ईपीएफओ", "यूएएन", "पेंशन", "निकासी", "दावा",
    "नियोक्ता", "कर्मचारी भविष्य निधि"
  ],
  te: [
    "భవిష్యత్తు నిధి", "పీఎఫ్", "ఈపీఎఫ్ఓ", "యూఏఎన్", "పెన్షన్", "ఉపసంహరణ",
    "క్లెయిమ్", "యజమాని"
  ]
};

const RAILMADAD_KEYWORDS: Keywords = {
  shared: [
    "train", "railway", "station", "coach", "berth", "seat", "pantry", "tc",
    "ticket examiner", "platform", "unreserved", "general ticket", "cleanliness",
    "bedroll", "water", "toilet", "staff behaviour", "vendor overcharging",
    "rmadad", "railmadad"
  ],
  en: ["rail complaint", "coach cleanliness"],
  hi: [
    "ट्रेन", "रेल", "स्टेशन", "कोच", "बर्थ", "सीट", "प्लेटफ़ॉर्म", "सफ़ाई",
    "पानी", "शौचालय", "टीसी", "पैंट्री", "चादर", "रेलवे"
  ],
  te: [
    "రైలు", "రైల్వే", "స్టేషన్", "కోచ్", "బర్త్", "సీటు", "ప్లాట్‌ఫారం",
    "శుభ్రత", "నీళ్లు", "మరుగుదొడ్డి", "టీసీ", "ప్యాంట్రీ"
  ]
};

const TDR_KEYWORDS: Keywords = {
  shared: [
    "tdr", "e-ticket", "eticket", "chart preparation", "chart prepared",
    "partially confirmed", "partial travel", "not travelled", "did not travel",
    "didn't board", "not boarded", "waitlisted", "rac", "irctc refund",
    "ticket refund", "file tdr"
  ],
  en: ["ticket deposit receipt"],
  hi: [
    "टीडीआर", "ई-टिकट", "चार्ट", "आंशिक रूप से कन्फर्म", "यात्रा नहीं की",
    "बोर्ड नहीं किया", "रैक", "वेटलिस्ट", "टिकट रिफंड"
  ],
  te: [
    "టీడీఆర్", "ఇ-టికెట్", "చార్ట్", "పాక్షికంగా కన్ఫర్మ్", "ప్రయాణం చేయలేదు",
    "ఎక్కలేదు", "రాక్", "వెయిట్‌లిస్ట్", "టికెట్ రీఫండ్"
  ]
};

function countMatches(text: string, keywords: Keywords): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const list of [keywords.shared, keywords.en, keywords.hi, keywords.te]) {
    for (const kw of list) {
      if (lower.includes(kw.toLowerCase())) score += 1;
    }
  }
  return score;
}

export interface KeywordScores {
  scores: Record<SystemId, number>;
  winner: SystemId;
  railwaySubflow?: RailwaySubflow;
}

/** Scores each system and picks a winner; ties or zero matches yield low confidence upstream. */
export function scoreSystems(text: string): KeywordScores {
  const scores: Record<SystemId, number> = {
    nch: countMatches(text, CONSUMER_KEYWORDS),
    epfo: countMatches(text, EPFO_KEYWORDS),
    // TDR/refund vocabulary counts toward the railways route as well.
    railways:
      countMatches(text, RAILMADAD_KEYWORDS) +
      Math.min(2, countMatches(text, TDR_KEYWORDS))
  };

  let winner: SystemId = "nch";
  let best = -1;
  for (const id of Object.keys(scores) as SystemId[]) {
    if (scores[id] > best) {
      best = scores[id];
      winner = id;
    }
  }

  let railwaySubflow: RailwaySubflow | undefined;
  if (winner === "railways") {
    const tdrScore = countMatches(text, TDR_KEYWORDS);
    railwaySubflow = tdrScore > 0 ? "tdr" : "railmadad";
  }

  return { scores, winner, railwaySubflow };
}
