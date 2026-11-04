import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const EXAMPLE_TEXT =
  "I ordered a pressure cooker for Rs 2,400 from ShopKart. It arrived dented and the seller has ignored my refund request for three weeks. Order number ORD-778812.";

const MOCK_TRIAGE = {
  data: {
    system: "nch",
    railwaySubflow: null,
    summary: "Consumer refund grievance against an online seller.",
    extractedFields: { orderNumber: "ORD-778812", amount: "2,400" },
    missingFields: ["merchant", "purchaseDate"],
    confidence: 0.9,
    urgency: "medium",
    disclaimer: "Prototype guidance only - not legal advice."
  },
  mode: "openai"
};

async function axeScan(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const serious = results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? "")
  );
  expect(
    serious.map((v) => `${v.id}: ${v.nodes.length} nodes`),
    "no serious/critical axe violations"
  ).toEqual([]);
}

test.describe("English citizen journey", () => {
  test("intake -> triage -> review -> submit -> dashboard -> case -> letter", async ({
    page
  }) => {
    await page.goto("/");
    // One-time reset: an init-script clear would also wipe storage on reload.
    await page.evaluate(() => window.localStorage.clear());
    await page.route("**/api/ai/triage", async (route) =>
      route.fulfill({ json: MOCK_TRIAGE })
    );
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Describe your problem"
    );
    await axeScan(page);

    await page.getByLabel("What went wrong?").fill(EXAMPLE_TEXT);
    await page.getByRole("checkbox", { name: /I agree to send my written description/ }).check();
    await page.getByRole("button", { name: /Identify my grievance system/ }).click();

    await expect(page).toHaveURL(/\/review$/);
    await expect(page.getByText("Consumer refund grievance")).toBeVisible();
    await expect(page.getByText("AI-assisted")).toBeVisible();
    await page.getByRole("checkbox", { name: /Include sample receipt/ }).click();

    await axeScan(page);
    await page.getByRole("button", { name: "Submit case" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    const caseLink = page.locator('a[href^="/case/CB-"]').first();
    await expect(caseLink).toBeVisible();
    await expect(page.getByText("Just submitted").first()).toBeVisible();
    await axeScan(page);

    await caseLink.click();
    await expect(page).toHaveURL(/\/case\/CB-\d{4}-\d{5}$/);
    await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible();
    await expect(
      page.getByText("Escalation becomes available once the trigger")
    ).toBeVisible();

    // Seeded overdue NCH case offers an editable escalation letter.
    await page.goto("/dashboard");
    await page.locator('a[href^="/case/CB-2026-10234"]').click();
    await expect(page).toHaveURL(/CB-2026-10234/);
    await expect(page.getByText("Consider taking the case further")).toBeVisible();
    await expect(page.getByText("Advisory")).toBeVisible();

    await page.getByRole("button", { name: "Prepare escalation letter" }).click();
    const letterBody = page.locator("#letter-body");
    await expect(letterBody).toBeVisible();
    await expect(letterBody).toContainText("NCH-2026-482913");
    await letterBody.fill(
      "Edited letter body prepared during automated end-to-end verification."
    );

    await page.getByRole("button", { name: "Copy letter" }).click();
    await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Download \.txt/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(
      "CivicBridge-escalation-CB-2026-10234.txt"
    );

    // Refresh keeps the edited letter cached in the local store.
    await page.reload();
    await expect(page.locator("#letter-body")).toBeVisible();
    await axeScan(page);
  });

  test("privacy guard blocks Aadhaar before anything is sent", async ({ page }) => {
    let triageCalled = false;
    await page.route("**/api/ai/triage", async (route) => {
      triageCalled = true;
      return route.fulfill({ json: MOCK_TRIAGE });
    });

    await page.goto("/");
    await page
      .getByLabel("What went wrong?")
      .fill("Please verify my complaint, my aadhaar is 2345 1234 5678 and I need help");
    await page.getByRole("checkbox", { name: /I agree to send my written description/ }).check();
    await page.getByRole("button", { name: /Identify my grievance system/ }).click();

    await expect(page.getByText("Please remove sensitive details")).toBeVisible();
    expect(triageCalled).toBe(false);
  });
});

test.describe("multilingual intake", () => {
  test("switches UI copy between English, Hindi and Telugu", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "हिन्दी" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "अपनी समस्या"
    );
    await expect(page.getByLabel("क्या समस्या हुई?")).toBeVisible();

    await page.getByRole("button", { name: "తెలుగు" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "మీ సమస్యను"
    );
    await expect(page.locator("html")).toHaveAttribute("lang", "te");
  });
});

test.describe("failure handling and fallback mode", () => {
  test("live keyless deployment still completes the journey via offline rules", async ({
    page,
    context
  }) => {
    await context.addInitScript(() => window.localStorage.clear());
    // No route mocking: dev server runs without OPENAI_API_KEY by config.
    await page.route("**/api/ai/triage", async (route) => route.continue());
    await page.goto("/");
    await page.getByLabel("What went wrong?").fill(EXAMPLE_TEXT);
    // Cold dev-server compilation of the route can be slow; wait for the wire.
    const triageResponse = page.waitForResponse(
      (r) => r.url().includes("/api/ai/triage"),
      { timeout: 90_000 }
    );
    await page.getByRole("checkbox", { name: /I agree to send my written description/ }).check();
    await page.getByRole("button", { name: /Identify my grievance system/ }).click();
    const response = await triageResponse;
    expect(response.status()).toBe(200);

    await expect(page).toHaveURL(/\/review$/);
    await expect(page.getByText("Offline rules").first()).toBeVisible();
    await expect(page.getByText("Prepared with offline rules")).toBeVisible();
  });

  test("triage API outage falls back locally without losing the draft", async ({
    page,
    context
  }) => {
    await context.addInitScript(() => window.localStorage.clear());
    await page.route("**/api/ai/triage", async (route) => route.abort());
    await page.goto("/");
    await page.getByLabel("What went wrong?").fill(EXAMPLE_TEXT);
    await page.getByRole("checkbox", { name: /I agree to send my written description/ }).check();
    await page.getByRole("button", { name: /Identify my grievance system/ }).click();

    await expect(page).toHaveURL(/\/review$/);
    await expect(page.getByText("Offline rules").first()).toBeVisible();
  });
});
