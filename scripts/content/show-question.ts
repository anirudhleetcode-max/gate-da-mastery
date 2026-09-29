/**
 * Print a question WITHOUT its answer/solution, for blind independent re-solving.
 *   npx tsx scripts/content/show-question.ts <file.json> [questionId]
 * For array files (mocks/practice) pass the question id.
 */
import fs from "node:fs";

const [file, id] = process.argv.slice(2);
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const q = Array.isArray(data) ? data.find((x: { id: string }) => x.id === id) : data;
if (!q) {
  console.error("question not found");
  process.exit(1);
}
console.log(`ID: ${q.id}\nTYPE: ${q.type}   MARKS: ${q.marks}\n`);
console.log(q.stem);
for (const o of q.options ?? []) console.log(`\n(${o.label}) ${o.text}`);
console.log("\n[answer and solution intentionally hidden]");
