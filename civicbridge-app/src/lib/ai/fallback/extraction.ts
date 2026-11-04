/**
 * Deterministic field extraction used when AI is unavailable (and as the
 * server-side sanitizer's second pass). Only extracts values that appear
 * next to an identifying keyword, so bare 12-digit numbers are never
 * mistaken for UANs.
 */

const PATTERNS: Array<{ key: string; re: RegExp }> = [
  {
    // PNR: keyword then 10 alphanumerics.
    key: "pnr",
    re: /\bpnr\W{0,8}([A-Z0-9]{10})\b|पी\.?एन\.?आर\.?\W{0,8}([A-Z0-9]{10})\b|పీఎన్ఆర్\W{0,8}([A-Z0-9]{10})\b/i
  },
  {
    key: "uan",
    re: /\buan\b\W{0,10}(\d{4}[\s-]?\d{4}[\s-]?\d{4})\b|यूएएन\W{0,10}(\d{4}[\s-]?\d{4}[\s-]?\d{4})\b|యూఏఎన్\W{0,10}(\d{4}[\s-]?\d{4}[\s-]?\d{4})\b/i
  },
  {
    key: "orderNumber",
    re: /\border(?:[\s-]*(?:number|no\.?|id))?\W{0,8}([A-Z]{0,5}-?\d{4,12})\b|ऑर्डर(?:[\s-]*नंबर)?\W{0,8}([A-Z]{0,5}-?\d{4,12})\b|ఆర్డర్(?:[\s-]*నంబర్)?\W{0,8}([A-Z]{0,5}-?\d{4,12})\b/i
  },
  {
    key: "transactionId",
    re: /\b(?:txn|transaction)(?:[\s-]*(?:id|no\.?))?\W{0,8}([A-Z0-9][A-Z0-9-]{4,20})\b|लेन-देन\W{0,8}([A-Z0-9][A-Z0-9-]{4,20})\b|లావాదేవీ\W{0,8}([A-Z0-9][A-Z0-9-]{4,20})\b/i
  },
  {
    key: "amount",
    re: /(?:₹|\brs\.?\b|\binr\b|रु\.?|रुपये?|రూ\.?)\s*([\d,]{1,12}(?:\.\d{1,2})?)/i
  },
  {
    key: "journeyDate",
    re: /\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/
  },
  {
    key: "trainNumber",
    re: /\btrain(?:[\s-]*(?:no\.?|number))?\W{0,6}(\d{4,5})\b|ट्रेन(?:[\s-]*नंबर)?\W{0,6}(\d{4,5})\b|रेलगाड़ी\W{0,6}(\d{4,5})\b|రైలు(?:[\s-]*నంబర్)?\W{0,6}(\d{4,5})\b/i
  },
  {
    key: "coach",
    re: /\bcoach\b\W{0,6}([A-Z]\d{1,3})\b|कोच\W{0,6}([A-Z]\d{1,3})\b|కోచ్\W{0,6}([A-Z]\d{1,3})\b/i
  },
  {
    key: "complaintNumber",
    re: /\b((?:RM|NCH|EPFO|GMS|TDR)[-/]\d{4,12})\b/i
  }
];

export function extractFieldsDeterministic(text: string): Record<string, string> {
  const found: Record<string, string> = {};
  for (const { key, re } of PATTERNS) {
    const m = text.match(re);
    // Multi-alternation patterns use several capture groups; take the first defined one.
    const value = m ? m.slice(1).find((g) => typeof g === "string") : undefined;
    if (value) {
      found[key] = value.trim();
    }
  }
  return found;
}

/** Field keys that are still missing from a set of known fields. */
export function missingFields(
  requiredKeys: string[],
  extracted: Record<string, string>
): string[] {
  return requiredKeys.filter(
    (k) =>
      !(k in extracted) ||
      extracted[k] === undefined ||
      extracted[k].trim() === ""
  );
}
