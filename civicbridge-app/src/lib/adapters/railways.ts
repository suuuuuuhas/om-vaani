import type {
  CaseRecord,
  EscalationContext,
  NextAction,
  NextActionPolicy,
  RailwaySubflow
} from "@/lib/types";
import { daysBetween } from "@/lib/utils/dates";
import { lockedNextAction, type CaseLike, type SystemAdapter } from "./types";

/**
 * RailMadad policy.
 * Sources:
 * - https://railmadad.indianrailways.gov.in/madad/feedback.jsp (fetched 2026-08-22;
 *   the public FAQ publishes no fixed response deadline)
 * - CPGRAMS guidance: https://pgportal.gov.in
 * Trigger is therefore unsatisfactory closure or continued non-resolution -
 * never an elapsed-days entitlement. A 45-day "stalled" heuristic is advisory.
 */
export const RAILMADAD_POLICY: NextActionPolicy = {
  triggerType: "unsatisfactory-response",
  thresholdDays: 45,
  timing: "advisory",
  sourceUrl: "https://railmadad.indianrailways.gov.in/madad/feedback.jsp",
  sourceLabel: "RailMadad FAQ / grievance portal",
  verifiedOn: "2026-08-22",
  verificationNote:
    "No fixed response deadline is published; 'Railway Ombudsman' routes are omitted until an official source is verified."
};

/**
 * TDR filing deadlines per IRCTC e-ticket cancellation rules.
 * Source: https://contents.irctc.co.in/en/eticketCancel.html
 * Verified 2026-08-22: confirmed tickets require cancellation/TDR filing up to
 * four hours before scheduled departure; RAC and partially-confirmed party
 * tickets up to thirty minutes before. After chart preparation, use online TDR
 * filing and IRCTC's refund tracking service.
 */
export const TDR_POLICY: NextActionPolicy = {
  triggerType: "filing-deadline",
  timing: "official",
  sourceUrl: "https://contents.irctc.co.in/en/eticketCancel.html",
  sourceLabel: "IRCTC e-ticket cancellation and TDR rules",
  verifiedOn: "2026-08-22"
};

const RAILMADAD_PORTAL_URL =
  "https://railmadad.indianrailways.gov.in/madad/finalnewcomplaint.jsp";

function railmadadNextAction(c: CaseLike, now: Date): NextAction {
  const days = daysBetween(new Date(c.createdAt), now);
  const unsatisfactory =
    c.statusCode === "closed-unsatisfactory" ||
    (c.lastResponse ? !c.lastResponse.satisfactory : false);

  if (unsatisfactory) {
    return {
      available: true,
      titleKey: "guidance.railmadad_closure_title",
      bodyKey: "guidance.railmadad_closure_body",
      policy: RAILMADAD_POLICY,
      daysElapsed: days
    };
  }

  const stalled =
    c.statusCode === "in-progress" || c.statusCode === "awaiting-response";
  if (stalled && days >= (RAILMADAD_POLICY.thresholdDays ?? 45)) {
    return {
      available: true,
      titleKey: "guidance.railmadad_stalled_title",
      bodyKey: "guidance.railmadad_stalled_body",
      policy: RAILMADAD_POLICY,
      daysElapsed: days,
      overdue: days > (RAILMADAD_POLICY.thresholdDays ?? 45)
    };
  }

  return {
    available: false,
    titleKey: "guidance.railmadad_closure_title",
    bodyKey: "guidance.railmadad_closure_body",
    policy: RAILMADAD_POLICY,
    daysElapsed: days
  };
}

function tdrNextAction(c: CaseLike, now: Date): NextAction {
  if (!c.filingDeadlineAt) {
    return lockedNextAction(
      "guidance.tdr_title",
      "guidance.tdr_body",
      TDR_POLICY
    );
  }
  const deadline = new Date(c.filingDeadlineAt);
  const expired = now.getTime() > deadline.getTime();
  return {
    available: true,
    titleKey: expired ? "guidance.tdr_expired_title" : "guidance.tdr_title",
    bodyKey: expired ? "guidance.tdr_expired_body" : "guidance.tdr_body",
    policy: TDR_POLICY,
    deadlineAt: c.filingDeadlineAt
  };
}

/**
 * Derives a TDR filing deadline for a newly created case.
 * IRCTC requires filing up to four hours before scheduled departure; with only
 * a date available we assume an early-morning departure (06:10). Unparseable
 * or past dates fall back to a 20-hour advisory window so the case stays usable.
 */
export function tdrDeadlineFromJourney(
  journeyDate: string | undefined,
  now: Date = new Date()
): { deadlineAt: string; official: boolean } {
  const m = (journeyDate ?? "").match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  const iso = (journeyDate ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  let departure: Date | null = null;
  if (m) {
    departure = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 6, 10);
  } else if (iso) {
    departure = new Date(
      Number(iso[1]),
      Number(iso[2]) - 1,
      Number(iso[3]),
      6,
      10,
      0
    );
  }
  if (!departure || Number.isNaN(departure.getTime()) || departure.getTime() <= now.getTime()) {
    return { deadlineAt: new Date(now.getTime() + 20 * 3_600_000).toISOString(), official: false };
  }
  return { deadlineAt: new Date(departure.getTime() - 4 * 3_600_000).toISOString(), official: true };
}

export const railwaysAdapter: SystemAdapter = {
  id: "railways",
  // RailMadad publishes no fixed window; used only for display heuristics.
  expectedResponseDays: 45,
  policy: RAILMADAD_POLICY,
  fieldKeys: [
    "pnr",
    "trainNumber",
    "coach",
    "journeyDate",
    "complaintNumber",
    "ticketClass",
    "transactionId",
    "amount"
  ],

  mockSubmit(_fields: Record<string, string>, railwaySubflow?: RailwaySubflow) {
    const n = Math.floor(100000 + Math.random() * 900000);
    const prefix = railwaySubflow === "tdr" ? "TDR" : "RM";
    return { referenceNumber: `${prefix}-2026-${n}` };
  },

  computeNextAction(c: CaseLike, now: Date = new Date()): NextAction {
    return c.railwaySubflow === "tdr"
      ? tdrNextAction(c, now)
      : railmadadNextAction(c, now);
  },

  buildEscalationContext(c: CaseRecord): EscalationContext {
    if (c.railwaySubflow === "tdr") {
      return {
        addressedTo: "IRCTC Customer Care / Concerned Railway Division (Refund Cell)",
        subjectTemplateKey: "escalationSubjects.tdr",
        facts: [
          { labelKey: "fields.pnr", value: c.fields.pnr ?? "-" },
          { labelKey: "fields.trainNumber", value: c.fields.trainNumber ?? "-" },
          { labelKey: "fields.journeyDate", value: c.fields.journeyDate ?? "-" },
          { labelKey: "referenceLabel", value: c.referenceNumber ?? c.id },
          { labelKey: "casePage.deadlineLabel", value: c.filingDeadlineAt ?? "-" }
        ],
        requestedResolutionKey: "escalationRequests.tdr",
        furtherOptions: [
          {
            nameKey: "systems.tdr_name",
            url: "https://contents.irctc.co.in/en/eticketCancel.html"
          }
        ]
      };
    }
    return {
      addressedTo: "RailMadad Grievance Cell, Indian Railways / CPGRAMS",
      subjectTemplateKey: "escalationSubjects.railmadad",
      facts: [
        { labelKey: "fields.complaintNumber", value: c.referenceNumber ?? c.id },
        { labelKey: "fields.pnr", value: c.fields.pnr ?? "-" },
        { labelKey: "fields.trainNumber", value: c.fields.trainNumber ?? "-" },
        { labelKey: "fields.coach", value: c.fields.coach ?? "-" }
      ],
      requestedResolutionKey: "escalationRequests.railmadad",
      furtherOptions: [
        { nameKey: "systems.railmadad_name", url: RAILMADAD_PORTAL_URL },
        { nameKey: "guidance.cpgrams_name", url: "https://pgportal.gov.in" }
      ]
    };
  }
};
