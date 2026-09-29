/**
 * Accessibility (axe-core, WCAG 2.1 A/AA) and responsive-overflow audit.
 *
 *   node scripts/dev/a11y-audit.mjs http://localhost:3100 [route ...]
 *
 * For every route: runs axe at 1280px (light and dark theme) and checks
 * horizontal page overflow at 320, 360, 390, 412, 768, 1024, 1440 and 1920px.
 * Writes reports/a11y-audit.{json,md}; exits 1 if any violation or overflow.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:3100";
const DEFAULT_ROUTES = [
  "/", "/syllabus", "/subjects", "/subjects/ml", "/subjects/ml/topics/ml-supervised", "/pyqs", "/pyqs/browse",
  "/pyqs/papers/DA-2026-S8", "/questions/DA2026-S8-Q36", "/questions/DA2024-S1-Q14", "/mocks", "/mocks/mock-01",
  "/practice", "/today", "/progress", "/weightage", "/revision", "/errors", "/bookmarks", "/search?q=eigenvalue",
  "/concepts", "/formulas", "/formulas/la", "/strategy", "/strategy/timer", "/roadmap", "/sources", "/settings", "/this-route-does-not-exist",
];
const routes = process.argv.length > 3 ? process.argv.slice(3) : DEFAULT_ROUTES;
const WIDTHS = [320, 360, 390, 412, 768, 1024, 1440, 1920];
const axeSrc = fs.readFileSync(path.resolve("node_modules/axe-core/axe.min.js"), "utf8");

const browser = await chromium.launch();
const results = [];
for (const route of routes) {
  const entry = { route, status: 0, violations: [], overflow: [], consoleErrors: [] };
  for (const scheme of ["light", "dark"]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error" && scheme === "light") entry.consoleErrors.push(m.text().slice(0, 200)); });
    const res = await page.goto(base + route, { waitUntil: "load", timeout: 60_000 }).catch((e) => ({ status: () => `ERR ${e.message.slice(0, 80)}` }));
    entry.status = res?.status?.() ?? 0;
    await page.waitForTimeout(1500); // hydration + client data (networkidle never settles with link prefetching)
    await page.addScriptTag({ content: axeSrc });
    const v = await page.evaluate(async () => {
      // eslint-disable-next-line no-undef
      const r = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } });
      return r.violations.map((x) => ({ id: x.id, impact: x.impact, help: x.help, nodes: x.nodes.slice(0, 4).map((n) => `${n.target.join(" ")} — ${n.failureSummary?.split("\n").slice(0, 2).join(" ")}`) }));
    });
    for (const x of v) entry.violations.push({ ...x, scheme });
    await ctx.close();
  }
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(base + route, { waitUntil: "load", timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(900);
    const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    if (o.sw > o.iw + 1) entry.overflow.push(`${w}px: scrollWidth ${o.sw}`);
    await ctx.close();
  }
  results.push(entry);
  const flag = entry.violations.length || entry.overflow.length ? "FAIL" : "ok  ";
  console.log(`${flag} ${route} [${entry.status}] axe:${entry.violations.length} overflow:${entry.overflow.length} console:${entry.consoleErrors.length}`);
}
await browser.close();

const bad = results.filter((r) => r.violations.length || r.overflow.length);
fs.mkdirSync("reports", { recursive: true });
fs.writeFileSync("reports/a11y-audit.json", JSON.stringify({ base, at: new Date().toISOString(), widths: WIDTHS, results }, null, 2) + "\n");
const md = [
  "# Accessibility & responsive audit",
  "",
  `Run: ${new Date().toISOString()} against ${base}. axe-core ${JSON.parse(fs.readFileSync("node_modules/axe-core/package.json", "utf8")).version}, WCAG 2.1 A/AA rules, light and dark themes at 1280px; horizontal overflow at ${WIDTHS.join(", ")} px.`,
  "",
  `Routes: ${results.length}, with violations or overflow: ${bad.length}.`,
  "",
  "| Route | HTTP | axe violations | Overflow | Console errors |",
  "| --- | --- | --- | --- | --- |",
  ...results.map((r) => `| ${r.route} | ${r.status} | ${r.violations.length ? r.violations.map((v) => `${v.id} (${v.scheme})`).join(", ") : "0"} | ${r.overflow.join("; ") || "none"} | ${r.consoleErrors.length} |`),
  "",
  ...bad.flatMap((r) => [`## ${r.route}`, ...r.violations.map((v) => `- **${v.id}** (${v.impact}, ${v.scheme}): ${v.help}\n  - ${v.nodes.join("\n  - ")}`), ...r.overflow.map((o) => `- overflow ${o}`), ""]),
].join("\n");
fs.writeFileSync("reports/a11y-audit.md", md + "\n");
process.exit(bad.length ? 1 : 0);
