/**
 * npm run sources:verify [-- --write]
 *
 * Downloads every source that has both an official URL and a recorded
 * SHA-256, hashes the bytes served by the OFFICIAL host, and compares.
 * A match upgrades the source to VERIFIED (with --write, content/sources.json
 * is updated). The build environment of this project could not reach the
 * official GATE hosts; run this from a network that can.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const FILE = path.join(ROOT, "content", "sources.json");

interface Src {
  id: string;
  url?: string;
  sha256?: string;
  verificationStatus: string;
  verificationNotes: string;
  verificationDate: string;
}

async function main() {
  const write = process.argv.includes("--write");
  const sources = JSON.parse(fs.readFileSync(FILE, "utf8")) as Src[];
  const today = new Date().toISOString().slice(0, 10);
  let changed = 0;
  for (const s of sources) {
    if (!s.url || !s.sha256) continue;
    process.stdout.write(`${s.id}: `);
    try {
      const res = await fetch(s.url, { redirect: "follow", signal: AbortSignal.timeout(60_000) });
      if (!res.ok) {
        console.log(`HTTP ${res.status}, left unchanged`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const hash = crypto.createHash("sha256").update(buf).digest("hex");
      if (hash === s.sha256) {
        console.log("MATCH, the official file is byte-identical to the file the content was built from");
        if (s.verificationStatus !== "VERIFIED") {
          s.verificationStatus = "VERIFIED";
          s.verificationNotes = `${s.verificationNotes} On ${today}, the SHA-256 of the file served by the official host matched the recorded hash.`;
          s.verificationDate = today;
          changed++;
        }
      } else {
        console.log(`MISMATCH (official ${hash.slice(0, 16)}…): the file must be reviewed manually`);
        s.verificationStatus = "NEEDS_REVIEW";
        s.verificationNotes = `${s.verificationNotes} On ${today}, the file served by the official host had a different SHA-256 (${hash}); manual review is required.`;
        s.verificationDate = today;
        changed++;
      }
    } catch (e) {
      console.log(`unreachable (${(e as Error).message}), left unchanged`);
    }
  }
  if (write && changed) {
    fs.writeFileSync(FILE, JSON.stringify(sources, null, 2) + "\n");
    console.log(`Updated ${changed} source(s) in content/sources.json. Run npm run content:build.`);
  } else if (changed) {
    console.log(`${changed} source(s) would change. Re-run with -- --write to save.`);
  }
}

void main();
