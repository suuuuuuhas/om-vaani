import type { PrivacyFinding } from "@/lib/types";

/**
 * Sensitive-data guard. Runs identically in the browser (before anything is
 * stored or sent) and on the server (before any AI call).
 *
 * Blocking rules cover: Aadhaar, PAN, OTP, passwords, CVV, banking login
 * credentials, full card numbers, and bank account numbers.
 *
 * Contextual allowlist: synthetic PNR, UAN, order and transaction references
 * are permitted, so a 12-digit UAN preceded by "UAN" is not flagged as an
 * Aadhaar number.
 */

interface PatternRule {
  kind: PrivacyFinding["kind"];
  pattern: RegExp;
}

/** 12 digits with optional separators - possible Aadhaar unless UAN context. */
const AADHAAR = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;
/** Masked Aadhaar like XXXX XXXX 1234. */
const AADHAAR_MASKED = /\b[Xx]{4}[\s-][Xx]{4}[\s-]\d{4}\b/g;
const PAN = /\b[A-Z]{5}\d{4}[A-Z]\b/g;
const OTP_WORD =
  /\b(otp|one[\s-]?time\s*(?:password|pin)|o\.t\.p)\b|एक\s*बार\s*का\s*पासवर्ड|वन[\s-]?टाइम\s*पासवर्ड|వన[\s-]?టైమ్\s*పాస్\u200c?వర్డ్/gi;
/** 4-8 digit code explicitly tied to OTP/PIN wording. */
const OTP_CODE = /\b(?:otp|pin)\D{0,12}\d{4,8}\b|\b\d{4,8}\D{0,12}\b(?:otp|pin)\b/gi;
const PASSWORD =
  /(?:\b(?:pass[\s-]?word|passcode|pwd)\b|पासवर्ड(?:़)?|పాస\u200c?వర్డ్)/gi;
const CVV = /\b(c\.?v\.?v\.?|c\.?v\.?c\.?|card\s*verification\s*(?:value|code))\b/gi;
const BANK_CREDENTIAL =
  /(?:\b(?:net[\s-]?banking|internet[\s-]?banking|mobile[\s-]?banking|upi|atm)\b\D{0,16}\b(?:password|pin|passcode)\b|\bbank\s*(?:login|password)\b|बैंक\s*(?:पासवर्ड|पिन)|यूपीआई\s*पिन|एटीएम\s*पिन)/gi;
/** 13-19 digit sequences - possible card numbers (Luhn-checked below). */
const CARD_CANDIDATE = /\b\d{13,19}\b/g;
// NOTE: \b never matches adjacent to Devanagari/Telugu letters, so script-specific
// branches are kept outside any \b group.
const ACCOUNT_NUMBER =
  /\b(?:account|a\/c|acct)\D{0,10}\d{9,18}\b|\b\d{9,18}\D{0,10}\b(?:account|a\/c)\b|(?:खाता|ఖాతా)\D{0,10}\d{9,18}|\d{9,18}\D{0,10}(?:खाता|ఖాతా)/gi;

/** UAN context: the 12-digit number is near a "uan" mention (any script). */
const UAN_CONTEXT =
  /\b(?:uan|u\.a\.n)\D{0,8}\d{4}[\s-]?\d{4}[\s-]?\d{4}\b|\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\D{0,8}\buan\b|(?:यूएएन|యూఏఎన్)\D{0,8}\d{4}[\s-]?\d{4}[\s-]?\d{4}|\d{4}[\s-]?\d{4}[\s-]?\d{4}\D{0,8}(?:यूएएन|యూఏఎన్)/i;

function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

function findMatches(text: string, rule: PatternRule): number {
  const flags = rule.pattern.flags.replace("g", "");
  const re = new RegExp(rule.pattern.source, flags + "g");
  let count = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    count += 1;
    if (m.index === re.lastIndex) re.lastIndex += 1;
  }
  return count;
}

export interface PrivacyGuardResult {
  ok: boolean;
  findings: PrivacyFinding[];
}

export function checkSensitiveContent(text: string): PrivacyGuardResult {
  const findings: PrivacyFinding[] = [];
  const push = (kind: PrivacyFinding["kind"], messageKey: string) => {
    if (!findings.some((f) => f.kind === kind)) {
      findings.push({ kind, messageKey });
    }
  };

  // Masked Aadhaar (XXXX XXXX 1234) is always blocked.
  if (findMatches(text, { kind: "aadhaar", pattern: AADHAAR_MASKED }) > 0) {
    push("aadhaar", "privacyMessages.aadhaar");
  }

  // 12-digit sequences: block as possible Aadhaar unless UAN context applies.
  const uanContext = UAN_CONTEXT.test(text);
  const twelveDigit = findMatches(text, { kind: "aadhaar", pattern: AADHAAR });
  if (twelveDigit > 0 && !uanContext) {
    push("aadhaar", "privacyMessages.aadhaar");
  }

  if (findMatches(text, { kind: "pan", pattern: PAN }) > 0) {
    push("pan", "privacyMessages.pan");
  }
  if (findMatches(text, { kind: "otp", pattern: OTP_WORD }) > 0) {
    push("otp", "privacyMessages.otp");
  } else if (findMatches(text, { kind: "otp", pattern: OTP_CODE }) > 0) {
    push("otp", "privacyMessages.otp");
  }
  if (findMatches(text, { kind: "password", pattern: PASSWORD }) > 0) {
    push("password", "privacyMessages.password");
  }
  if (findMatches(text, { kind: "cvv", pattern: CVV }) > 0) {
    push("cvv", "privacyMessages.cvv");
  }
  if (findMatches(text, { kind: "bank-credential", pattern: BANK_CREDENTIAL }) > 0) {
    push("bank-credential", "privacyMessages.bank_credential");
  }

  // Card candidates: only flag digit runs that pass Luhn and are not UAN-context.
  const cardRe = new RegExp(CARD_CANDIDATE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = cardRe.exec(text)) !== null) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhnValid(digits) && !uanContext) {
      push("card-number", "privacyMessages.card_number");
      break;
    }
  }

  if (findMatches(text, { kind: "account-number", pattern: ACCOUNT_NUMBER }) > 0) {
    push("account-number", "privacyMessages.account_number");
  }

  return { ok: findings.length === 0, findings };
}

/** Hard cap applied to all free-text before storage or AI calls. */
export const MAX_INTAKE_LENGTH = 4000;

export function clampIntakeText(text: string): string {
  return text.slice(0, MAX_INTAKE_LENGTH).trim();
}
