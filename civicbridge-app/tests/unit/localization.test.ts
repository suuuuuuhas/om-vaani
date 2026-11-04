import { describe, expect, it } from "vitest";
import { DICTIONARIES, flattenKeys, formatMessage, getDictionary, lookupMessage } from "@/lib/i18n";
import { LOCALES } from "@/lib/types";

describe("localization completeness", () => {
  it("hindi and telugu dictionaries match the english key set exactly", () => {
    const enKeys = flattenKeys(DICTIONARIES.en).sort();
    for (const locale of ["hi", "te"] as const) {
      const keys = flattenKeys(DICTIONARIES[locale]).sort();
      expect(keys).toEqual(enKeys);
    }
  });

  it("every locale resolves status labels for every status code", () => {
    const statuses = [
      "submitted",
      "in_progress",
      "awaiting_response",
      "response_received",
      "closed_unsatisfactory"
    ];
    for (const locale of LOCALES) {
      const dict = getDictionary(locale);
      for (const s of statuses) {
        const value = lookupMessage(dict, `status.${s}`);
        expect(typeof value, `${locale}/status.${s}`).toBe("string");
        expect(value!.length).toBeGreaterThan(2);
      }
    }
  });

  it("every locale resolves all timeline kinds and guidance bodies", () => {
    const keys = [
      "timeline.submitted",
      "timeline.acknowledged",
      "timeline.in_progress",
      "timeline.response_received",
      "timeline.closed_unsatisfactory",
      "guidance.nch_title",
      "guidance.nch_body",
      "guidance.epfo_body",
      "guidance.railmadad_closure_body",
      "guidance.railmadad_stalled_body",
      "guidance.tdr_body",
      "guidance.tdr_expired_body"
    ];
    for (const locale of LOCALES) {
      for (const key of keys) {
        expect(lookupMessage(getDictionary(locale), key), `${locale}/${key}`).toBeTruthy();
      }
    }
  });

  it("keeps escalation subject/request namespaces complete", () => {
    for (const locale of LOCALES) {
      for (const key of [
        "escalationSubjects.nch",
        "escalationSubjects.epfo",
        "escalationSubjects.railmadad",
        "escalationSubjects.tdr",
        "escalationRequests.nch",
        "escalationRequests.epfo",
        "escalationRequests.railmadad",
        "escalationRequests.tdr"
      ]) {
        expect(lookupMessage(getDictionary(locale), key), `${locale}/${key}`).toBeTruthy();
      }
    }
  });
});

describe("message utilities", () => {
  it("formats placeholders", () => {
    expect(formatMessage("{n} days ago", { n: 12 })).toBe("12 days ago");
    expect(formatMessage("{n} / 4000", { n: "40" })).toBe("40 / 4000");
    expect(formatMessage("no params")).toBe("no params");
    expect(formatMessage("{missing}", {})).toBe("{missing}");
  });

  it("resolves dotted lookups and misses gracefully", () => {
    expect(lookupMessage(DICTIONARIES.en, "app.name")).toBe("Civic Sathi");
    expect(lookupMessage(DICTIONARIES.en, "does.not.exist")).toBeUndefined();
  });

  it("falls back to English for unknown locales", () => {
    expect(getDictionary("xx" as never)).toBe(DICTIONARIES.en);
  });
});
