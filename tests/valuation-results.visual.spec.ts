import { expect, test } from "@playwright/test";

test("Results card visual snapshot", async ({ page }) => {
  await page.goto(
    "/boat-valuation?wholesale=990000&market=1700000&replacement=2295000",
  );
  await page.waitForTimeout(200);
  const card = page
    .locator('[data-testid="market-tile"]')
    .locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
  await expect(card).toBeVisible();
  await expect(card).toHaveScreenshot("results-card.png", {
    maxDiffPixelRatio: 0.02,
  });
});
