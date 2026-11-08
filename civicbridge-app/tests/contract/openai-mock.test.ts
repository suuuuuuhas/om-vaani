import { afterEach, describe, expect, it } from "vitest";
import { triageGrievance } from "@/lib/ai/triage-service";
import { fallbackTriage } from "@/lib/ai/fallback/triage";
import { explainStatus } from "@/lib/ai/status-service";
import { fallbackExplanation } from "@/lib/ai/fallback/status";
import { draftEscalationLetter } from "@/lib/ai/escalation-service";
import type { CaseSnapshot } from "@/lib/ai/schemas";
import type { ResponsesLike } from "@/lib/ai/client";

const VALID_TRIAGE_JSON = JSON.stringify({
  system: "nch",
  railwaySubflow: null,
  summary: "Consumer refund grievance against an online seller.",
  fields: {
    pnr: null,
    uan: null,
    orderNumber: "ORD-778812",
    transactionId: null,
    amount: "2400",
    journeyDate: null,
    trainNumber: null,
    coach: null,
    complaintNumber: null
  },
  confidence: 0.88,
  urgency: "medium",
  disclaimer: "Prototype guidance only - not legal advice."
});

function fakeClient(impl: () => Promise<{ output_text?: string }>): ResponsesLike {
  return { responses: { create: impl } };
}

function snapshotFixture(): CaseSnapshot {
  return {
    id: "CB-2026-10001",
    system: "nch",
    locale: "en",
    originalText: "Seller refused a refund for a defective mixer grinder.",
    fields: { orderNumber: "ORD-5512093", amount: "3400" },
    statusCode: "awaiting-response",
    referenceNumber: "NCH-2026-482913",
    expectedResponseDays: 30,
    createdAt: new Date(Date.now() - 34 * 86_400_000).toISOString()
  };
}

afterEach(() => {
  delete process.env.OPENAI_API_KEY;
});

describe("triage service contract", () => {
  it("uses live AI mode on valid structured output", async () => {
    const client = fakeClient(async () => ({ output_text: VALID_TRIAGE_JSON }));
    const result = await triageGrievance(
      "Refund refused for defective mixer. Order ORD-778812 of Rs 2,400.",
      "en",
      client
    );
    expect(result.mode).toBe("openai");
    expect(result.data.system).toBe("nch");
    expect(result.data.extractedFields.orderNumber).toBe("ORD-778812");
  });

  it("extracts stated consumer details without marking complete fields missing", async () => {
    const value = JSON.parse(VALID_TRIAGE_JSON);
    Object.assign(value.fields, { merchant: "ShopKart", productName: "mixer", purchaseDate: "2026-10-01", complaintNumber: "C123" });
    const client = fakeClient(async () => ({ output_text: JSON.stringify(value) }));
    const result = await triageGrievance("ShopKart mixer bought 2026-10-01, order ORD-778812, Rs 2400, complaint C123. Refund refused.", "en", client);
    expect(result.data.extractedFields.merchant).toBe("ShopKart");
    expect(result.data.extractedFields.productName).toBe("mixer");
    expect(result.data.extractedFields.purchaseDate).toBe("2026-10-01");
    expect(result.data.missingFields).toEqual([]);
  });

  it("keeps Vaani's conversational reply alongside the case summary", async () => {
    const value = JSON.parse(VALID_TRIAGE_JSON);
    value.assistantReply = "I'm sorry the mixer arrived damaged. How much did you pay?";
    const client = fakeClient(async () => ({ output_text: JSON.stringify(value) }));
    const result = await triageGrievance("The mixer arrived broken and the seller refused my refund.", "en", client);
    expect(result.data.assistantReply).toBe(value.assistantReply);
    expect(result.data.summary).toBe(value.summary);
  });

  it("falls back on malformed JSON", async () => {
    const client = fakeClient(async () => ({
      output_text: '{"system": "nch", broken...'
    }));
    const result = await triageGrievance("refund for defective order", "en", client);
    expect(result.mode).toBe("fallback");
    expect(result.data.confidence).toBeGreaterThan(0);
  });

  it("falls back when the model returns an invalid system enum", async () => {
    const bad = VALID_TRIAGE_JSON.replace('"nch"', '"police"');
    const client = fakeClient(async () => ({ output_text: bad }));
    const result = await triageGrievance("refund for defective order", "en", client);
    expect(result.mode).toBe("fallback");
    expect(["nch", "epfo", "railways"]).toContain(result.data.system);
  });

  it("falls back on rate-limit errors (429)", async () => {
    const client = fakeClient(async () => {
      const err = new Error("429 rate limited") as Error & { status?: number };
      err.status = 429;
      throw err;
    });
    const result = await triageGrievance("PF claim pending UAN 101234567890", "en", client);
    expect(result.mode).toBe("fallback");
    expect(result.data.system).toBe("epfo");
  });

  it("falls back on timeouts", async () => {
    const client = fakeClient(async () => {
      throw Object.assign(new Error("Request timed out"), { name: "APIConnectionTimeoutError" });
    });
    const result = await triageGrievance("train coach dirty PNR 4529871653", "en", client);
    expect(result.mode).toBe("fallback");
  });

  it("falls back immediately with no key and no injected client", async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await triageGrievance("seller refused refund", "en");
    expect(result.mode).toBe("fallback");
  });

  it("deterministic fallback is stable across calls", async () => {
    const a = fallbackTriage("PF withdrawal stuck UAN 101234567890", "hi");
    const b = fallbackTriage("PF withdrawal stuck UAN 101234567890", "hi");
    expect(a).toEqual(b);
    expect(a.summary).toMatch(/[\u0900-\u097F]/);
  });
});

describe("status explanation service contract", () => {
  it("returns AI mode on valid output", async () => {
    const client = fakeClient(async () => ({
      output_text: JSON.stringify({
        explanation:
          "This case has been waiting longer than the usual response window; you can consider the next step."
      })
    }));
    const result = await explainStatus(snapshotFixture(), client);
    expect(result.mode).toBe("openai");
    expect(result.data.explanation.length).toBeGreaterThan(10);
  });

  it("falls back to deterministic explanations on failure - localized", async () => {
    const failing = fakeClient(async () => {
      throw new Error("boom");
    });
    const en = await explainStatus(snapshotFixture(), failing);
    expect(en.mode).toBe("fallback");
    expect(fallbackExplanation(snapshotFixture())).toMatch(/synthetic demonstration case/i);

    const hiSnap = { ...snapshotFixture(), locale: "hi" as const };
    expect(fallbackExplanation(hiSnap)).toMatch(/[\u0900-\u097F]/);

    const teSnap = { ...snapshotFixture(), locale: "te" as const };
    expect(fallbackExplanation(teSnap)).toMatch(/[\u0C00-\u0C7F]/);
  });
});

describe("escalation drafting service contract", () => {
  function inputFixture() {
    return {
      snapshot: snapshotFixture(),
      addressedTo: "National Consumer Helpline - Convergence Cell",
      factLines: [
        { label: "Complaint reference", value: "NCH-2026-482913" },
        { label: "Amount (Rs)", value: "3400" }
      ],
      sourceUrl: "https://www.consumerhelpline.gov.in/public/convergenceprogram"
    };
  }

  it("returns AI mode on valid letters", async () => {
    const longBody =
      "Respected Sir or Madam,\n\nI wish to bring the following grievance to your attention regarding my unresolved consumer complaint and request a written resolution at the earliest.\n\nSincerely.";
    const client = fakeClient(async () => ({
      output_text: JSON.stringify({ subject: "Unresolved consumer complaint", body: longBody })
    }));
    const result = await draftEscalationLetter(inputFixture(), client);
    expect(result.mode).toBe("openai");
    expect(result.data.subject.toLowerCase()).toContain("consumer");
  });

  it("falls back to templates on malformed or too-short bodies", async () => {
    const client = fakeClient(async () => ({
      output_text: JSON.stringify({ subject: "Hi", body: "too short" })
    }));
    const result = await draftEscalationLetter(inputFixture(), client);
    expect(result.mode).toBe("fallback");
    expect(result.data.body).toContain("NCH-2026-482913");
    expect(result.data.body).toContain(inputFixture().addressedTo);
    expect(result.data.body).toContain(inputFixture().sourceUrl);
  });

  it("localizes fallback letters for hindi and telugu", async () => {
    const hi = await draftEscalationLetter(
      { ...inputFixture(), snapshot: { ...snapshotFixture(), locale: "hi" } },
      undefined
    );
    expect(hi.mode).toBe("fallback");
    expect(hi.data.body).toMatch(/[\u0900-\u097F]/);

    const te = await draftEscalationLetter(
      { ...inputFixture(), snapshot: { ...snapshotFixture(), locale: "te" } },
      undefined
    );
    expect(te.data.body).toMatch(/[\u0C00-\u0C7F]/);
  });
});
