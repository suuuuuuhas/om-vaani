import type {
  CaseRecord,
  CaseStatusCode,
  EscalationContext,
  NextAction,
  NextActionPolicy,
  RailwaySubflow,
  SystemId
} from "@/lib/types";
/** Minimal shape adapters need; CaseRecord satisfies it. */
export interface CaseLike {
  system: SystemId;
  railwaySubflow?: RailwaySubflow;
  statusCode: CaseStatusCode;
  createdAt: string;
  filingDeadlineAt?: string;
  lastResponse?: { receivedAt: string; satisfactory: boolean };
}

export interface SystemAdapter {
  id: SystemId;
  /** Expected response window used for "overdue" display. */
  expectedResponseDays: number;
  policy: NextActionPolicy;
  /** Editable field keys (i18n `fields.*`) in display order. */
  fieldKeys: string[];
  /** Issues a synthetic reference number - nothing is sent anywhere. */
  mockSubmit(
    fields: Record<string, string>,
    railwaySubflow?: RailwaySubflow
  ): { referenceNumber: string };
  computeNextAction(c: CaseLike, now?: Date): NextAction;
  buildEscalationContext(c: CaseRecord): EscalationContext;
}

export const WAITING_STATUSES: CaseStatusCode[] = [
  "submitted",
  "in-progress",
  "awaiting-response"
];

export function isWaiting(status: CaseStatusCode): boolean {
  return WAITING_STATUSES.includes(status);
}

export function lockedNextAction(
  titleKey: string,
  bodyKey: string,
  policy: NextActionPolicy
): NextAction {
  return { available: false, titleKey, bodyKey, policy };
}
