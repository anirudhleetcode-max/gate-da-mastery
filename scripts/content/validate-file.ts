/**
 * Validate one or more content files: `npx tsx scripts/content/validate-file.ts <file...>`
 * Chooses the schema from the path. Exit code 1 on any error.
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { Concept, Formula, OriginalQuestion, Pyq, Syllabus } from "../../src/lib/content/schema";
import { buildTaxonomyIndex, validateQuestionSemantics, type Issue } from "../../src/lib/content/validate";

const ROOT = path.resolve(__dirname, "../..");
const syllabus = Syllabus.parse(JSON.parse(fs.readFileSync(path.join(ROOT, "content/syllabus.json"), "utf8")));
const tax = buildTaxonomyIndex(syllabus);
const figureExists = (p: string) => p.startsWith("/") && fs.existsSync(path.join(ROOT, "public", p));

function check(file: string): Issue[] {
  const rel = path.relative(ROOT, path.resolve(file)).split(path.sep).join("/");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const issues: Issue[] = [];
  const zodIssues = (e: z.ZodError, entity: string) =>
    e.issues.forEach((i) => issues.push({ level: "error", entity, message: `${i.path.join(".")}: ${i.message}` }));

  if (rel.startsWith("content/pyqs/")) {
    const r = Pyq.safeParse(data);
    if (!r.success) zodIssues(r.error, rel);
    else {
      issues.push(...validateQuestionSemantics(r.data, tax, { figureExists }));
      const expectedName = `${r.data.id}.json`;
      if (path.basename(rel) !== expectedName) issues.push({ level: "error", entity: rel, message: `file must be named ${expectedName}` });
    }
  } else if (rel.startsWith("content/mocks/questions/") || rel.startsWith("content/practice/")) {
    const r = z.array(OriginalQuestion).safeParse(data);
    if (!r.success) zodIssues(r.error, rel);
    else for (const q of r.data) issues.push(...validateQuestionSemantics(q, tax, { figureExists }));
  } else if (rel.startsWith("content/concepts/")) {
    const r = z.array(Concept).safeParse(data);
    if (!r.success) zodIssues(r.error, rel);
    else for (const c of r.data) {
      if (tax.topics.get(c.topicId) !== c.subjectId) issues.push({ level: "error", entity: c.id, message: `topic ${c.topicId} not in subject ${c.subjectId}` });
      for (const st of c.subtopicIds) if (!tax.subtopics.has(st)) issues.push({ level: "error", entity: c.id, message: `unknown subtopic ${st}` });
    }
  } else if (rel.startsWith("content/formulas/")) {
    const r = z.array(Formula).safeParse(data);
    if (!r.success) zodIssues(r.error, rel);
    else for (const f of r.data) {
      if (tax.topics.get(f.topicId) !== f.subjectId) issues.push({ level: "error", entity: f.id, message: `topic ${f.topicId} not in subject ${f.subjectId}` });
    }
  } else {
    issues.push({ level: "warning", entity: rel, message: "no per-file validator for this path (checked by content:build)" });
  }
  return issues;
}

let errors = 0;
for (const f of process.argv.slice(2)) {
  let issues: Issue[];
  try {
    issues = check(f);
  } catch (e) {
    issues = [{ level: "error", entity: f, message: `unreadable/invalid JSON: ${(e as Error).message}` }];
  }
  const errs = issues.filter((i) => i.level === "error");
  errors += errs.length;
  if (!issues.length) console.log(`OK   ${f}`);
  for (const i of issues) console.log(`${i.level === "error" ? "ERR " : "WARN"} ${f} [${i.entity}] ${i.message}`);
}
process.exit(errors ? 1 : 0);
