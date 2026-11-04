import { describe, expect, it } from "vitest";
import { extractFieldsDeterministic, missingFields } from "@/lib/ai/fallback/extraction";
import { scoreSystems } from "@/lib/ai/fallback/keywords";
import { CASE_ID_PATTERN, generateCaseId } from "@/lib/utils/id";
import { buildSeedStore } from "@/data/seed-cases";
import type { SystemId } from "@/lib/types";

describe("deterministic extraction", () => {
  it("extracts PNR only next to its keyword", () => {
    const fields = extractFieldsDeterministic("Train was late, PNR 4529871653 not used");
    expect(fields.pnr).toBe("4529871653");
    expect(extractFieldsDeterministic("random digits 4529871653 here").pnr).toBeUndefined();
  });

  it("extracts UAN with context but never bare 12-digit runs", () => {
    expect(extractFieldsDeterministic("UAN 101234567890 pending").uan).toBe("101234567890");
    expect(extractFieldsDeterministic("claim 101234567890 stuck").uan).toBeUndefined();
  });

  it("extracts order numbers, transaction ids and amounts", () => {
    const fields = extractFieldsDeterministic(
      "Refund due for order ORD-778812, transaction TXN-99312 of Rs 2,400"
    );
    expect(fields.orderNumber).toMatch(/^ORD-?778812$/i);
    expect(fields.transactionId.toUpperCase()).toContain("TXN");
    expect(fields.amount).toBe("2,400");
  });

  it("extracts train numbers and coaches", () => {
    const fields = extractFieldsDeterministic("Coach B3 of train 12621 was filthy");
    expect(fields.trainNumber).toBe("12621");
    expect(fields.coach).toBe("B3");
  });

  it("computes missing fields against required keys", () => {
    const missing = missingFields(
      ["pnr", "trainNumber", "coach"],
      extractFieldsDeterministic("PNR 4732891560")
    );
    expect(missing).toEqual(["trainNumber", "coach"]);
  });
});

describe("keyword routing (fallback triage)", () => {
  it("routes consumer grievances to NCH", () => {
    const result = scoreSystems("Seller refused refund for defective mixer grinder order");
    expect(result.winner).toBe<SystemId>("nch");
  });

  it("routes EPF issues to EPFO in English and Hindi", () => {
    expect(scoreSystems("PF withdrawal claim pending with employer contribution").winner).toBe("epfo");
    expect(scoreSystems("मेरा भविष्य निधि दावा 18 दिनों से लंबित है").winner).toBe("epfo");
  });

  it("routes railway complaints and detects the TDR subflow in three languages", () => {
    const madad = scoreSystems("Coach cleanliness was terrible at the station pantry water toilet");
    expect(madad.winner).toBe("railways");
    expect(madad.railwaySubflow).toBe("railmadad");

    const tdrEn = scoreSystems("File TDR for partially confirmed e-ticket chart prepared RAC");
    expect(tdrEn.railwaySubflow).toBe("tdr");

    const tdrTe = scoreSystems("టీడీఆర్ ఫైల్ చేయాలి, ఇ-టికెట్ పాక్షికంగా కన్ఫర్మ్");
    expect(tdrTe.winner).toBe("railways");
    expect(tdrTe.railwaySubflow).toBe("tdr");

    const tdrHi = scoreSystems("ट्रेन छूट गई, ई-टिकट का टीडीआर कराना है, चार्ट बन गया");
    expect(tdrHi.railwaySubflow).toBe("tdr");
  });

  it("falls back to NCH with no subflow when nothing matches", () => {
    const result = scoreSystems("zzz qqq unclassifiable text");
    expect(result.winner).toBe("nch");
    expect(result.railwaySubflow).toBeUndefined();
  });
});

describe("case id generation", () => {
  it("matches the CB-YYYY-##### contract", () => {
    const now = new Date("2026-03-04T10:00:00Z");
    for (let i = 0; i < 50; i += 1) {
      expect(generateCaseId(now)).toMatch(CASE_ID_PATTERN);
      expect(generateCaseId(now).startsWith("CB-2026-")).toBe(true);
    }
  });

  it("respects taken ids", () => {
    let calls = 0;
    const id = generateCaseId(new Date(), () => {
      calls += 1;
      return calls < 40;
    });
    expect(calls).toBe(40);
    expect(id).toMatch(CASE_ID_PATTERN);
  });
});

describe("seed data integrity", () => {
  const store = buildSeedStore();

  it("seeds exactly five synthetic cases under the demo profile", () => {
    expect(store.cases.length).toBe(5);
    expect(store.version).toBe(1);
    expect(store.profile.isSynthetic).toBe(true);
  });

  it("covers all three systems including both railway subflows", () => {
    const systems = new Set(store.cases.map((c) => c.system));
    expect(systems).toEqual(new Set(["nch", "epfo", "railways"]));
    const railSubflows = new Set(
      store.cases.filter((c) => c.system === "railways").map((c) => c.railwaySubflow)
    );
    expect(railSubflows).toEqual(new Set(["railmadad", "tdr"]));
  });

  it("includes unresolved, overdue-window, unsatisfactory and recent examples", () => {
    expect(store.cases.some((c) => c.statusCode === "awaiting-response")).toBe(true);
    expect(store.cases.some((c) => c.statusCode === "closed-unsatisfactory")).toBe(true);
    expect(store.cases.some((c) => c.statusCode === "in-progress")).toBe(true);
    expect(store.cases.some((c) => c.lastResponse && !c.lastResponse.satisfactory)).toBe(true);
  });

  it("gives every case valid ids, policies, timelines and triage summaries", () => {
    for (const c of store.cases) {
      expect(c.id).toMatch(CASE_ID_PATTERN);
      expect(new Date(c.createdAt).toString()).not.toBe("Invalid Date");
      expect(c.timeline.length).toBeGreaterThan(0);
      expect(c.timeline[0].kind).toBe("submitted");
      expect(c.triage.summary.length).toBeGreaterThan(5);
      expect(c.referenceNumber).toMatch(
        /^(NCH-\d{4}-\d{6}|EPFO-GMS-\d{6}|(RM|TDR)-\d{4}-\d{6})$/
      );
    }
  });

  it("sets a future filing deadline on the TDR case", () => {
    const tdr = store.cases.find((c) => c.railwaySubflow === "tdr")!;
    expect(tdr.filingDeadlineAt).toBeDefined();
    expect(new Date(tdr.filingDeadlineAt!).getTime()).toBeGreaterThan(Date.now());
  });

  it("keeps multilingual seed texts in Hindi and Telugu where intended", () => {
    const hindiCase = store.cases.find((c) => c.locale === "hi");
    const teluguCase = store.cases.find((c) => c.locale === "te");
    expect(hindiCase?.originalText).toMatch(/[\u0900-\u097F]/);
    expect(teluguCase?.originalText).toMatch(/[\u0C00-\u0C7F]/);
  });
});
