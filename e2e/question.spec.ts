import { expect, test } from "@playwright/test";

const Q = "/questions/DA2026-S8-Q36"; // official MCQ, key (D), 2 marks

test.describe("official PYQ page", () => {
  test("shows official metadata and origin label", async ({ page }) => {
    await page.goto(Q);
    await expect(page.getByRole("heading", { name: "GATE DA 2026 · Q.36" })).toBeVisible();
    await expect(page.getByText("Official GATE PYQ").first()).toBeVisible();
    await expect(page.getByText("15 Feb 2026")).toBeVisible();
    await expect(page.getByText(/Session 8 · Afternoon/)).toBeVisible();
    await expect(page.getByText("MCQ · 2 marks")).toBeVisible();
  });

  test("wrong MCQ answer applies GATE negative marking and records follow-ups", async ({ page }) => {
    await page.goto(Q);
    await page.locator("label", { hasText: "(B)" }).first().click();
    await page.getByRole("button", { name: "Submit answer" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Incorrect" })).toContainText("-0.67");
    await expect(page.getByRole("heading", { name: "Solution" })).toBeVisible();
    await expect(page.getByText("Correct answer", { exact: true })).toBeVisible();
    await expect(page.getByText("Added to your")).toBeVisible();
    await expect(page.getByRole("button", { name: /In revision queue/ })).toBeDisabled();
    // Explanation levels
    await page.getByRole("radio", { name: "Quick" }).click();
    await expect(page.getByRole("radio", { name: "Quick" })).toHaveAttribute("aria-checked", "true");
  });

  test("correct answer scores full marks; reveal works without recording", async ({ page }) => {
    await page.goto(Q);
    await page.locator("label", { hasText: "(D)" }).first().click();
    await page.getByRole("button", { name: "Submit answer" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Correct" })).toContainText("+2");
    await page.goto(Q);
    await page.getByRole("button", { name: "Reveal answer" }).click();
    await expect(page.getByText("Nothing was recorded")).toBeVisible();
  });

  test("bookmark toggles", async ({ page }) => {
    await page.goto(Q);
    const b = page.getByRole("button", { name: "Bookmark" });
    await b.click();
    await expect(page.getByRole("button", { name: "Bookmarked" })).toHaveAttribute("aria-pressed", "true");
  });

  test("no horizontal overflow", async ({ page }) => {
    await page.goto(Q);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test("unknown question returns the not-found page", async ({ page }) => {
  const res = await page.goto("/questions/does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Page not found")).toBeVisible();
});
