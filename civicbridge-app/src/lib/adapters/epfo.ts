import type {
  CaseRecord,
  EscalationContext,
  NextAction,
  NextActionPolicy
} from "@/lib/types";
import { daysBetween } from "@/lib/utils/dates";
import { lockedNextAction, type CaseLike, type SystemAdapter } from "./types";

/**
 * EPFO grievance follow-up policy.
 * Source: https://www.epfindia.gov.in/site_en/Contact.php
 * Verification attempted 2026-08-22: the site was unreachable from the build
 * environment, so no official timing claim is made. The 15-day follow-up and
 * RPFC/CPGRAMS routes are presented as cautious suggestions only.
 */
export const EPFO_POLICY: NextActionPolicy = {
  triggerType: "elapsed",
  thresholdDays: 15,
  timing: "advisory",
  sourceUrl: "https://www.epfindia.gov.in/site_en/Contact.php",
  sourceLabel: "EPFO contact guidance",
  verifiedOn: "2026-08-22",
  verificationNote:
    "Site unreachable at build time; guidance summarized cautiously and shown as advisory."
};

const EPFO_TITLE = "guidance.epfo_title";
const EPFO_BODY = "guidance.epfo_body";

export const epfoAdapter: SystemAdapter = {
  id: "epfo",
  expectedResponseDays: 15,
  policy: EPFO_POLICY,
  fieldKeys: ["uan", "claimId", "employerId", "amount"],

  mockSubmit() {
    const n = Math.floor(100000 + Math.random() * 900000);
    return { referenceNumber: `EPFO-GMS-${n}` };
  },

  computeNextAction(c: CaseLike, now: Date = new Date()): NextAction {
    const days = daysBetween(new Date(c.createdAt), now);
    const unsatisfactory = c.lastResponse ? !c.lastResponse.satisfactory : false;
    const pendingLong =
      (c.statusCode === "in-progress" || c.statusCode === "awaiting-response") &&
      days >= (EPFO_POLICY.thresholdDays ?? 15);

    if (unsatisfactory || pendingLong) {
      return {
        available: true,
        titleKey: EPFO_TITLE,
        bodyKey: EPFO_BODY,
        policy: EPFO_POLICY,
        daysElapsed: days,
        overdue: pendingLong && days > 15
      };
    }
    return lockedNextAction(EPFO_TITLE, EPFO_BODY, EPFO_POLICY);
  },

  buildEscalationContext(c: CaseRecord): EscalationContext {
    return {
      addressedTo:
        "Regional Provid Fund Commissioner (Complaints) / CPGRAMS",
      subjectTemplateKey: "escalationSubjects.epfo",
      facts: [
        { labelKey: "fields.complaintNumber", value: c.referenceNumber ?? c.id },
        { labelKey: "fields.uan", value: c.fields.uan ?? "-" },
        { labelKey: "fields.claimId", value: c.fields.claimId ?? "-" },
        { labelKey: "fields.employerId", value: c.fields.employerId ?? "-" },
        { labelKey: "fields.amount", value: c.fields.amount ?? "-" }
      ],
      requestedResolutionKey: "escalationRequests.epfo",
      furtherOptions: [
        {
          nameKey: "systems.epfo_name",
          url: "https://www.epfindia.gov.in/site_en/Contact.php"
        },
        { nameKey: "guidance.cpgrams_name", url: "https://pgportal.gov.in" }
      ]
    };
  }
};
