/**
 * npm run content:freeze-pyqs → content/exam/pyq-freeze.json
 *
 * Records a SHA-256 of every PYQ file. tests/pyq-dataset.test.ts fails if a
 * frozen PYQ file changes, so verified official questions cannot be edited
 * silently while other work proceeds. Re-run deliberately (and review the
 * diff) only when a PYQ correction is intended.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const dir = path.join(ROOT, "content", "pyqs");
const files: Record<string, string> = {};
for (const year of fs.readdirSync(dir).sort()) {
  for (const f of fs.readdirSync(path.join(dir, year)).sort()) {
    if (!f.endsWith(".json")) continue;
    const buf = fs.readFileSync(path.join(dir, year, f));
    files[`${year}/${f}`] = crypto.createHash("sha256").update(buf).digest("hex");
  }
}
const out = { frozenAt: new Date().toISOString(), count: Object.keys(files).length, files };
fs.writeFileSync(path.join(ROOT, "content", "exam", "pyq-freeze.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`froze ${out.count} PYQ files`);
