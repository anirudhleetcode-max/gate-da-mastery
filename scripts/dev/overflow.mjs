import { chromium } from "@playwright/test";
const url = process.argv[2];
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto(url, { waitUntil: "load" }); await p.waitForTimeout(1500);
const r = await p.evaluate(() => {
  const W = window.innerWidth; const out = [];
  for (const el of document.querySelectorAll("body *")) {
    const rc = el.getBoundingClientRect();
    if (rc.right > W + 1 && rc.width > 0) {
      let a = el.parentElement, clipped = false;
      while (a) { const o = getComputedStyle(a).overflowX; if (o === "auto" || o === "hidden" || o === "scroll") { clipped = true; break; } a = a.parentElement; }
      if (!clipped) out.push(`${el.tagName.toLowerCase()}.${(el.className?.baseVal ?? el.className ?? "").toString().slice(0,60)} right=${Math.round(rc.right)} "${(el.textContent||"").trim().slice(0,40)}"`);
    }
  }
  return { sw: document.documentElement.scrollWidth, W, out: out.slice(0, 8) };
});
console.log(JSON.stringify(r, null, 1)); await b.close();
