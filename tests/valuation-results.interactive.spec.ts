import { test, expect } from "@playwright/test";

test("interactive gauge updates the Market Value block on hover", async ({ page }) => {
  await page.goto("/boat-valuation?wholesale=990000&market=1650000&replacement=2227500");
  await expect(page).toHaveTitle(/Boat Valuation \| HullPrice/i);
  const slider = page.getByRole("slider", { name: /valuation gauge/i });
  await expect(slider).toBeVisible();
  const marketBlock = page.getByTestId("market-tile");
  const initialValue = (await marketBlock.innerText()).trim();
  const box = await slider.boundingBox();
  if (!box) throw new Error("Expected gauge to have a bounding box");
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await expect.poll(async () => (await marketBlock.innerText()).trim()).not.toBe(initialValue);
});
