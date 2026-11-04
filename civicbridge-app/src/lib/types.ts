export type Locale = "en" | "hi" | "te";

export const LOCALES: Locale[] = ["en", "hi", "te"];

export type SystemId = "nch" | "epfo" | "railways";

export type RailwaySubflow = "railmadad" | "tdr";

export type TriggerType =
  | "elapsed"
  | "unsatisfactory-response"
  | "filing-deadline";

/** Whether the timing behind a next action comes from an official rule or is an advisory suggestion. */
export type TimingKind = "official" | "advisory";

export type Urgency = "low" | "medium" | "high";

/**
 * Source-backed escalation policy for one system.
 * Every policy carries its source URL and the date the claim was verified.
 */
export interface NextActionPolicy {
  triggerType: TriggerType;
  /** Advisory elapsed-days threshold, when applicable. */
  thresholdDays?: number;
  timing: TimingKind;
  sourceUrl: string;
  sourceLabel: string;
  /** ISO date of the last verification attempt against the source. */
  verifiedOn: string;
  /** Notes about verification limits (e.g. site unreachable at verification time). */
  verificationNote?: string;
}

export type CaseStatusCode =
  | "submitted"
  | "in-progress"
  | "awaiting-response"
  | "response-received"
  | "closed-unsatisfactory";

export type TimelineEntryKind =
  | "submitted"
  | "acknowledged"
  | "in-progress"
  | "response-received"
  | "reminder"
  | "closed-unsatisfactory"
  | "escalation-available";

export interface TimelineEntry {
  isoDate: string;
  kind: TimelineEntryKind;
  /** Optional synthetic system reference shown with this entry. */
  reference?: string;
}

export interface ExtractedFieldDef {
  key: string;
  /** i18n key under `fields`. */
  labelKey: string;
  hintKey?: string;
  required?: boolean;
}

export interface TriageResult {
  system: SystemId;
  railwaySubflow?: RailwaySubflow;
  /** Plain-language summary in the requested locale. */
  summary: string;
  extractedFields: Record<string, string>;
  missingFields: string[];
  /** 0..1 */
  confidence: number;
  urgency: Urgency;
  disclaimer: string;
}

export interface PrivacyFinding {
  kind:
    | "aadhaar"
    | "pan"
    | "otp"
    | "password"
    | "cvv"
    | "bank-credential"
    | "card-number"
    | "account-number";
  messageKey: string;
}

export interface Attachment {
  id: string;
  name: string;
  kind: "receipt" | "screenshot";
  synthetic: true;
  dataUrl: string;
  /** Fields mock-extracted from the attachment. */
  extracted: Record<string, string>;
}

export type ExecutionMode = "openai" | "gemini" | "fallback";

export interface ServiceResult<T> {
  data: T;
  mode: ExecutionMode;
}

export interface DemoProfile {
  id: "demo-citizen";
  displayName: string;
  isSynthetic: true;
}

export interface DraftState {
  text: string;
  locale: Locale;
  voiceLanguage?: string;
  triage: TriageResult | null;
  mode: ExecutionMode | null;
  reviewFields?: Record<string, string>;
  reviewSystem?: SystemId;
  reviewSubflow?: RailwaySubflow;
}

export interface CaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  originalText: string;
  locale: Locale;
  system: SystemId;
  railwaySubflow?: RailwaySubflow;
  triage: TriageResult;
  /** User-corrected field values. */
  fields: Record<string, string>;
  attachments: Attachment[];
  statusCode: CaseStatusCode;
  /** Synthetic reference issued by the mocked submission. */
  referenceNumber?: string;
  expectedResponseDays: number;
  timeline: TimelineEntry[];
  policy: NextActionPolicy;
  /** For TDR cases: deadline by which the TDR must be filed (ISO). */
  filingDeadlineAt?: string;
  lastResponse?: {
    receivedAt: string;
    satisfactory: boolean;
  };
  cachedLetter?: {
    subject: string;
    body: string;
    mode: ExecutionMode;
  };
}

/** Computed next action shown in the dashboard and case page. */
export interface NextAction {
  available: boolean;
  /** i18n key for the short title of the action. */
  titleKey: string;
  /** i18n key for the full guidance body. */
  bodyKey: string;
  policy: NextActionPolicy;
  /** For filing-deadline triggers. */
  deadlineAt?: string;
  daysElapsed?: number;
  overdue?: boolean;
}

export interface EscalationContext {
  addressedTo: string;
  subjectTemplateKey: string;
  facts: Array<{ labelKey: string; value: string }>;
  requestedResolutionKey: string;
  furtherOptions: Array<{ nameKey: string; url: string }>;
}
