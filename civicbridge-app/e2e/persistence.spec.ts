import { expect, test } from "@playwright/test";

test.describe("local demo store", () => {
  test("fresh visitor receives exactly five seeded cases", async ({ browser }) => {
    const context = await browser.newContext();
    await context.addInitScript(() => window.localStorage.clear());
    const page = await context.newPage();
    await page.goto("/dashboard");
    await expect(page.locator('a[href^="/case/CB-"]')).toHaveCount(5);
    await context.close();
  });

  test("state survives a refresh under the versioned key", async ({ page }) => {
    await page.goto("/dashboard");
    // Simulate a wiped store; the next load must re-seed deterministically.
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await expect(page.locator('a[href^="/case/CB-"]')).toHaveCount(5);
    const raw = await page.evaluate(() =>
      window.localStorage.getItem("civicbridge-demo-v1")
    );
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as { version: number; cases: unknown[] };
    expect(parsed.version).toBe(1);
    expect(parsed.cases).toHaveLength(5);
  });

  test("missing case id renders the not-found state", async ({ page }) => {
    await page.goto("/case/CB-2026-99999");
    await expect(page.getByText("Case not found")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "All cases" }).first()
    ).toBeVisible();
  });

  test("reset restores the five sample cases after deletion", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator('a[href^="/case/CB-"]')).toHaveCount(5);

    await page.evaluate(() => {
      const store = JSON.parse(
        window.localStorage.getItem("civicbridge-demo-v1")!
      );
      store.cases = [];
      window.localStorage.setItem(
        "civicbridge-demo-v1",
        JSON.stringify(store)
      );
    });
    await page.reload();
    await expect(page.getByText("No cases yet")).toBeVisible();

    await page.getByRole("button", { name: "Reset demo data" }).click();
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(page.locator('a[href^="/case/CB-"]')).toHaveCount(5);
  });

  test("seeded overdue NCH case exposes its sourced next action on the dashboard", async ({
    page
  }) => {
    await page.goto("/dashboard");
    const row = page.locator('a[href^="/case/CB-2026-10234"]');
    await expect(row).toContainText("Waiting for a response");
    await expect(row).toContainText("Overdue");
    await expect(row).toContainText("consumerhelpline.gov.in");
  });
});
