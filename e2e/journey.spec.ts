/**
 * The complete student journey (docs: final QA, 25 stages), run in one
 * browser context so state carries across stages exactly as for a student:
 * dashboard → syllabus → subject → topic → concept → formula → practice →
 * PYQ attempted wrongly → wrong-answer explanation → practise the concept →
 * bookmark → bookmarks → available mock (navigate, answer, mark, submit) →
 * results → mistakes → weak topics → practice → progress → Today.
 */
import { expect, test, type Page } from "@playwright/test";

const PYQ = "/questions/DA2026-S8-Q36"; // official MCQ, key (D), 2 marks — (B) is wrong

async function noOverflow(page: Page) {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(o, `horizontal overflow on ${page.url()}`).toBeLessThanOrEqual(1);
}

test.describe.configure({ mode: "serial" });

test("full student journey", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await test.step("1-2 open the platform and the dashboard", async () => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    await noOverflow(page);
  });

  await test.step("3 open the syllabus", async () => {
    await page.goto("/syllabus");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Syllabus/i);
    await noOverflow(page);
  });

  await test.step("4-5 select a subject and open a topic", async () => {
    await page.goto("/subjects");
    await page.getByRole("link", { name: /Machine Learning/ }).first().click();
    await expect(page).toHaveURL(/\/subjects\/ml/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Machine Learning");
    await page.goto("/subjects/ml");
    const topicLink = page.locator('a[href^="/subjects/ml/topics/"]').first();
    await topicLink.click();
    await expect(page).toHaveURL(/\/subjects\/ml\/topics\//);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await noOverflow(page);
  });

  await test.step("6 read a concept", async () => {
    await page.goto("/concepts");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const concept = page.locator('a[href^="/concepts/"]').first();
    if (await concept.count()) {
      await concept.click();
      await expect(page).toHaveURL(/\/concepts\/c-/);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator(".katex").first()).toBeVisible();
    }
    await noOverflow(page);
  });

  await test.step("7 open a formula", async () => {
    await page.goto("/formulas");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goto("/formulas/la");
    await expect(page.locator(".katex").first()).toBeVisible();
    await noOverflow(page);
  });

  await test.step("8 practise questions", async () => {
    await page.goto("/practice?subject=ps&count=5");
    await page.getByRole("button", { name: /^Start/ }).first().click();
    await expect(page.getByRole("button", { name: "Submit answer" })).toBeVisible();
  });

  await test.step("9-11 attempt a PYQ, get it wrong, read the wrong-answer explanation", async () => {
    await page.goto(PYQ);
    await expect(page.getByText("Official GATE PYQ").first()).toBeVisible();
    await page.locator("label", { hasText: "(B)" }).first().click();
    await page.getByRole("button", { name: "Submit answer" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Incorrect" })).toContainText("-0.67");
    await expect(page.getByText("Why your answer is wrong")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Solution" })).toBeVisible();
  });

  await test.step("12 practise the concept", async () => {
    await page.getByRole("link", { name: /Practice this concept/ }).click();
    await expect(page).toHaveURL(/\/practice\?/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  await test.step("13-14 bookmark the question and open bookmarks", async () => {
    await page.goto(PYQ);
    await page.getByRole("button", { name: "Bookmark" }).click();
    await expect(page.getByRole("button", { name: "Bookmarked" })).toHaveAttribute("aria-pressed", "true");
    await page.goto("/bookmarks");
    await expect(page.getByRole("link", { name: /Q\.?\s?36|DA 2026|2026/ }).first()).toBeVisible();
    await noOverflow(page);
  });

  await test.step("15-19 take an available mock: navigate, answer, mark for review, submit", async () => {
    await page.goto("/mocks/mock-01");
    await page.getByRole("link", { name: /Start Mock 1|Retake Mock 1/ }).click();
    await expect(page).toHaveURL(/\/mocks\/mock-01\/exam/);
    await expect(page.getByLabel(/Time remaining/)).toBeVisible();
    // Answer question 1 (whatever its type): first option, or a number for NAT.
    const answerOne = async () => {
      const nat = page.getByRole("textbox").first();
      if (await nat.isVisible().catch(() => false)) await nat.fill("1");
      else await page.locator("label").filter({ hasText: /^\s*\(?A\)?/ }).first().click();
    };
    await answerOne();
    await page.getByRole("button", { name: /Save & next/ }).click();
    await page.getByRole("button", { name: /Mark for review & next/ }).click();
    await page.getByRole("button", { name: "Previous" }).click();
    await page.getByRole("button", { name: "Submit test" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Submit the test?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Submit test" }).click();
    await expect(page).toHaveURL(/\/mocks\/mock-01\/results\//, { timeout: 30_000 });
  });

  await test.step("20-22 view the result, inspect mistakes, see topic weakness", async () => {
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/Question review/).first()).toBeVisible();
    await expect(page.getByText(/Weak topics/).first()).toBeVisible();
    await noOverflow(page);
  });

  await test.step("23 return to practice", async () => {
    await page.goto("/practice");
    await expect(page.getByRole("heading", { level: 1, name: /Practice/ })).toBeVisible();
  });

  await test.step("24 check progress", async () => {
    await page.goto("/progress");
    await expect(page.getByRole("heading", { level: 1, name: "Progress" })).toBeVisible();
    await expect(page.getByText(/No progress to analyse yet/)).toHaveCount(0);
    await noOverflow(page);
  });

  await test.step("25 use Today's GATE DA", async () => {
    await page.goto("/today");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByRole("button", { name: /Start today's questions|Start from the first question/ }).first().click();
    await expect(page.getByRole("button", { name: "Submit answer" })).toBeVisible();
  });

  expect(errors, "uncaught page errors").toEqual([]);
});
