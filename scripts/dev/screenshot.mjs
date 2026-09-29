import { chromium } from "@playwright/test";
const [url, out, w, h, action] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: Number(w||1280), height: Number(h||900) } });
const errs=[]; p.on("pageerror", e=>errs.push(String(e))); p.on("console", m=>{ if(m.type()==="error") errs.push(m.text()); });
await p.goto(url, { waitUntil: "load", timeout: 20000 }); await p.waitForTimeout(1200);
if (action === "reveal") { await p.getByRole("button", { name: "Reveal answer" }).click(); await p.waitForTimeout(500); }
if (action === "answer") { await p.locator("label", { hasText: "(B)" }).first().click(); await p.getByRole("button", { name: "Submit answer" }).click(); await p.waitForTimeout(800); }
await p.screenshot({ path: out, fullPage: true });
console.log("errors:", errs);
await b.close();
