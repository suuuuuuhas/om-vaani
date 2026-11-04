import type {
  CaseRecord,
  EscalationContext,
  NextAction,
  NextActionPolicy
} from "@/lib/types";
import { daysBetween } from "@/lib/utils/dates";
import { isWaiting, lockedNextAction, type CaseLike, type SystemAdapter } from "./types";

/**
 * National Consumer Helpline (NCH) convergence program.
 * Source: https://www.consumerhelpline.gov.in/public/convergenceprogram
 * Verified 2026-08-22: "Grievances are forwarded in real time, and responses
 * are expected within 30 days." The 30-day figure is an expectation, not a
 * legal entitlement, so escalation guidance stays advisory.
 */
export const NCH_POLICY: NextActionPolicy = {
  triggerType: "elapsed",
  thresholdDays: 30,
  timing: "advisory",
  sourceUrl: "https://www.consumerhelpline.gov.in/public/convergenceprogram",
  sourceLabel: "NCH Convergence Program (Department of Consumer Affairs)",
  verifiedOn: "2026-08-22"
};

const NCH_TITLE = "guidance.nch_title";
const NCH_BODY = "guidance.nch_body";

export const nchAdapter: SystemAdapter = {
  id: "nch",
  expectedResponseDays: 30,
  policy: NCH_POLICY,
  fieldKeys: [
    "orderNumber",
    "merchant",
    "productName",
    "amount",
    "purchaseDate",
    "complaintNumber"
  ],

  mockSubmit() {
    const n = Math.floor(100000 + Math.random() * 900000);
    return { referenceNumber: `NCH-2026-${n}` };
  },

  computeNextAction(c: CaseLike, now: Date = new Date()): NextAction {
    const days = daysBetween(new Date(c.createdAt), now);
    const waiting = isWaiting(c.statusCode);
    if (waiting && days >= NCH_POLICY.thresholdDays!) {
    return {
      available: true,
      titleKey: NCH_TITLE,
      bodyKey: NCH_BODY,
      policy: NCH_POLICY,
      daysElapsed: days,
      overdue: days > (NCH_POLICY.thresholdDays ?? 30)
    };
    }
    return lockedNextAction(NCH_TITLE, NCH_BODY, NCH_POLICY);
  },

  buildEscalationContext(c: CaseRecord): EscalationContext {
    return {
      addressedTo: "National Consumer Helpline - Convergence Cell / District Consumer Commission (e-Jagriti)",
      subjectTemplateKey: "escalationSubjects.nch",
      facts: [
        { labelKey: "fields.complaintNumber", value: c.referenceNumber ?? c.id },
        { labelKey: "fields.merchant", value: c.fields.merchant ?? "-" },
        { labelKey: "fields.orderNumber", value: c.fields.orderNumber ?? "-" },
        { labelKey: "fields.amount", value: c.fields.amount ?? "-" },
        { labelKey: "casePage.expectedResponseLabel", value: `${c.expectedResponseDays} days` }
      ],
      requestedResolutionKey: "escalationRequests.nch",
      furtherOptions: [
        { nameKey: "guidance.cpgrams_name", url: "https://pgportal.gov.in" }
      ]
    };
  }
};
