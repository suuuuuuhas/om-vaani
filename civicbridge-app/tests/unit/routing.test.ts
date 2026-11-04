import { describe, expect, it } from "vitest";
import { ADAPTERS, getAdapter, adapterForTriage } from "@/lib/adapters";
import { TDR_POLICY, tdrDeadlineFromJourney } from "@/lib/adapters/railways";
import type { CaseLike, SystemAdapter } from "@/lib/adapters/types";
import type { CaseRecord, NextActionPolicy, RailwaySubflow, TriageResult } from "@/lib/types";

function makeCaseLike(overrides: Partial<CaseLike> = {}): CaseLike {
  const now = Date.now();
  return {
    system: "nch",
    statusCode: "awaiting-response",
    createdAt: new Date(now - 40 * 86_400_000).toISOString(),
    ...overrides
  };
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

describe("adapter routing", () => {
  it("routes each system to the correct adapter", () => {
    expect(getAdapter("nch").id).toBe("nch");
    expect(getAdapter("epfo").id).toBe("epfo");
    expect(getAdapter("railways").id).toBe("railways");
    expect(Object.keys(ADAPTERS).sort()).toEqual(["epfo", "nch", "railways"]);
  });

  it("resolves the railway subflow from triage results", () => {
    const railmadadTriage = {
      system: "railways",
      railwaySubflow: "railmadad"
    } as unknown as TriageResult;
    const tdrTriage = {
      system: "railways",
      railwaySubflow: "tdr"
    } as unknown as TriageResult;
    expect(adapterForTriage(railmadadTriage).adapter.id).toBe("railways");
    expect(adapterForTriage(tdrTriage).adapter.id).toBe("railways");
  });
});

describe("escalation boundaries - NCH (elapsed >= 30 days, advisory)", () => {
  const adapter: SystemAdapter = ADAPTERS.nch;

  it("stays locked before the 30-day window", () => {
    const action = adapter.computeNextAction(makeCaseLike({ createdAt: daysAgo(29) }));
    expect(action.available).toBe(false);
  });

  it("becomes available exactly at 30 days", () => {
    const action = adapter.computeNextAction(makeCaseLike({ createdAt: daysAgo(30) }));
    expect(action.available).toBe(true);
  });

  it("never claims official entitlement", () => {
    expect(adapter.policy.timing).toBe("advisory");
    expect(adapter.policy.triggerType).toBe("elapsed");
    expect(adapter.policy.thresholdDays).toBe(30);
  });

  it("stores its verified source", () => {
    expect(adapter.policy.sourceUrl).toBe(
      "https://www.consumerhelpline.gov.in/public/convergenceprogram"
    );
    expect(adapter.policy.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("ignores closed cases even when old", () => {
    const action = adapter.computeNextAction(
      makeCaseLike({ createdAt: daysAgo(60), statusCode: "closed-unsatisfactory" })
    );
    expect(action.available).toBe(false);
  });
});

describe("escalation boundaries - EPFO (>=15 days or unsatisfactory)", () => {
  const adapter: SystemAdapter = ADAPTERS.epfo;

  it("stays locked at 14 days", () => {
    const action = adapter.computeNextAction(makeCaseLike({ system: "epfo", createdAt: daysAgo(14) }));
    expect(action.available).toBe(false);
  });

  it("becomes available at 15 days of pending time", () => {
    const action = adapter.computeNextAction(makeCaseLike({ system: "epfo", createdAt: daysAgo(15) }));
    expect(action.available).toBe(true);
  });

  it("triggers early on an unsatisfactory response regardless of age", () => {
    const action = adapter.computeNextAction(
      makeCaseLike({
        system: "epfo",
        createdAt: daysAgo(3),
        lastResponse: { receivedAt: daysAgo(1), satisfactory: false }
      })
    );
    expect(action.available).toBe(true);
  });

  it("keeps timing advisory because EPFO publishes no fixed SLA here", () => {
    expect(adapter.policy.timing).toBe("advisory");
  });
});

describe("escalation boundaries - RailMadad (unsatisfactory or long stall)", () => {
  const adapter: SystemAdapter = ADAPTERS.railways;

  function madadCase(overrides: Partial<CaseLike> = {}): CaseLike {
    return makeCaseLike({
      system: "railways",
      railwaySubflow: "railmadad",
      ...overrides
    });
  }

  it("triggers on an unsatisfactory closure", () => {
    const action = adapter.computeNextAction(
      madadCase({ statusCode: "closed-unsatisfactory", createdAt: daysAgo(10) })
    );
    expect(action.available).toBe(true);
    expect(action.titleKey).toBe("guidance.railmadad_closure_title");
  });

  it("does not trigger on a young waiting case (no published deadline)", () => {
    const action = adapter.computeNextAction(madadCase({ createdAt: daysAgo(20) }));
    expect(action.available).toBe(false);
  });

  it("offers a cautious stalled-case option only after the advisory threshold", () => {
    const early = adapter.computeNextAction(madadCase({ createdAt: daysAgo(44) }));
    const late = adapter.computeNextAction(madadCase({ createdAt: daysAgo(45) }));
    expect(early.available).toBe(false);
    expect(late.available).toBe(true);
    expect(late.titleKey).toBe("guidance.railmadad_stalled_title");
  });

  it("omits unverified ombudsman claims and stays advisory", () => {
    expect(adapter.policy.timing).toBe("advisory");
    expect(adapter.policy.triggerType).toBe("unsatisfactory-response");
    expect(adapter.policy.sourceLabel.toLowerCase()).toContain("railmadad");
  });
});

describe("escalation boundaries - TDR (official filing deadline)", () => {
  const adapter: SystemAdapter = ADAPTERS.railways;

  function tdrCase(filingDeadlineAt?: string): CaseLike {
    return makeCaseLike({
      system: "railways",
      railwaySubflow: "tdr",
      statusCode: "in-progress",
      createdAt: daysAgo(1),
      filingDeadlineAt
    });
  }

  it("uses the official IRCTC-derived policy", () => {
    expect(TDR_POLICY.timing).toBe("official");
    expect(TDR_POLICY.triggerType).toBe("filing-deadline");
    expect(TDR_POLICY.sourceUrl).toBe("https://contents.irctc.co.in/en/eticketCancel.html");
  });

  it("surfaces the deadline while there is still time", () => {
    const future = new Date(Date.now() + 24 * 3_600_000).toISOString();
    const action = adapter.computeNextAction(tdrCase(future));
    expect(action.available).toBe(true);
    expect(action.titleKey).toBe("guidance.tdr_title");
    expect(action.deadlineAt).toBe(future);
  });

  it("switches to the missed-window guidance once the deadline passes", () => {
    const past = new Date(Date.now() - 3_600_000).toISOString();
    const action = adapter.computeNextAction(tdrCase(past));
    expect(action.available).toBe(true);
    expect(action.titleKey).toBe("guidance.tdr_expired_title");
  });

  it("derives deadlines four hours before an assumed morning departure", () => {
    const now = new Date("2026-08-22T00:00:00Z");
    const result = tdrDeadlineFromJourney("25/08/2026", now);
    expect(result.official).toBe(true);
    const deadline = new Date(result.deadlineAt);
    const departure = new Date(2026, 7, 25, 6, 10);
    expect(departure.getTime() - deadline.getTime()).toBe(4 * 3_600_000);
  });

  it("falls back to an advisory window when no date is parseable", () => {
    const now = new Date();
    const result = tdrDeadlineFromJourney(undefined, now);
    expect(result.official).toBe(false);
    expect(new Date(result.deadlineAt).getTime()).toBeGreaterThan(now.getTime());
  });
});

describe("policy integrity across adapters", () => {
  it("every policy carries source, verification date, and trigger type", () => {
    const policies: Array<[string, NextActionPolicy]> = [
      ["nch", ADAPTERS.nch.policy],
      ["epfo", ADAPTERS.epfo.policy],
      ["railmadad", ADAPTERS.railways.policy],
      ["tdr", TDR_POLICY]
    ];
    for (const [, policy] of policies) {
      expect(policy.sourceUrl.startsWith("https://")).toBe(true);
      expect(policy.sourceLabel.length).toBeGreaterThan(3);
      expect(policy.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(["elapsed", "unsatisfactory-response", "filing-deadline"]).toContain(
        policy.triggerType
      );
      expect(["official", "advisory"]).toContain(policy.timing);
    }
  });

  it("issues synthetic reference numbers per subflow", () => {
    const fields: Record<string, string> = {};
    expect(ADAPTERS.nch.mockSubmit(fields).referenceNumber).toMatch(/^NCH-\d{4}-\d{6}$/);
    expect(ADAPTERS.epfo.mockSubmit(fields).referenceNumber).toMatch(/^EPFO-GMS-\d{6}$/);
    expect(
      ADAPTERS.railways.mockSubmit(fields, "railmadad" as RailwaySubflow).referenceNumber
    ).toMatch(/^RM-\d{4}-\d{6}$/);
    expect(
      ADAPTERS.railways.mockSubmit(fields, "tdr" as RailwaySubflow).referenceNumber
    ).toMatch(/^TDR-\d{4}-\d{6}$/);
  });

  it("builds escalation contexts with further options", () => {
    const record = {
      id: "CB-2026-12345",
      referenceNumber: "NCH-2026-111111",
      expectedResponseDays: 30,
      fields: { merchant: "ShopKart", orderNumber: "ORD-1" },
      system: "nch"
    } as unknown as CaseRecord;
    const ctx = ADAPTERS.nch.buildEscalationContext(record);
    expect(ctx.addressedTo.length).toBeGreaterThan(5);
    expect(ctx.facts.length).toBeGreaterThan(2);
    expect(ctx.furtherOptions[0].url.startsWith("https://")).toBe(true);
  });
});
