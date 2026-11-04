import { describe, expect, it } from "vitest";
import { checkSensitiveContent, clampIntakeText } from "@/lib/privacy/guard";

describe("sensitive-data guard", () => {
  it("blocks plain and masked Aadhaar numbers", () => {
    expect(checkSensitiveContent("my aadhaar is 2345 1234 5678").ok).toBe(false);
    expect(checkSensitiveContent("aadhaar 234512345678 please").ok).toBe(false);
    expect(checkSensitiveContent("Aadhaar XXXX XXXX 4321 on file").ok).toBe(false);
  });

  it("blocks PAN numbers", () => {
    const result = checkSensitiveContent("PAN ABCDE1234F belongs to me");
    expect(result.ok).toBe(false);
    expect(result.findings[0].kind).toBe("pan");
  });

  it("blocks OTP references with or without codes", () => {
    expect(checkSensitiveContent("the OTP I received is fine").ok).toBe(false);
    expect(checkSensitiveContent("otp 4482 entered").ok).toBe(false);
    expect(checkSensitiveContent("वन टाइम पासवर्ड डाला").ok).toBe(false);
  });

  it("blocks passwords, CVVs and banking credentials", () => {
    for (const text of [
      "password hunter2 for the portal",
      "पासवर्ड 1234",
      "card cvv 123",
      "netbanking password reset",
      "UPI PIN 558821",
      "ATM PIN 9911"
    ]) {
      expect(checkSensitiveContent(text).ok, `should block: ${text}`).toBe(false);
    }
  });

  it("blocks Luhn-valid card-like runs", () => {
    expect(checkSensitiveContent("charge my card 4111111111111111").ok).toBe(false);
  });

  it("blocks account numbers tied to account wording", () => {
    expect(checkSensitiveContent("account number 123456789 was debited").ok).toBe(false);
    expect(checkSensitiveContent("खाता संख्या 123456789").ok).toBe(false);
  });

  it("permits synthetic PNR, contextual UAN, order and transaction references", () => {
    for (const text of [
      "PNR 4529871653 train late",
      "UAN 101234567890 claim pending",
      "order ORD-778812 refund",
      "txn TXN-99312 failed",
      "complaint RM-2026-118342 closed"
    ]) {
      const result = checkSensitiveContent(text);
      expect(result.ok, `should allow: ${text} -> ${JSON.stringify(result.findings)}`).toBe(true);
    }
  });

  it("reports stable message keys for localization", () => {
    const result = checkSensitiveContent("aadhaar 2345 1234 5678");
    expect(result.findings[0].messageKey).toBe("privacyMessages.aadhaar");
  });

  it("clamps intake length to the documented bound", () => {
    expect(clampIntakeText("x".repeat(5000)).length).toBe(4000);
    expect(clampIntakeText("  trimmed  ")).toBe("trimmed");
  });
});
