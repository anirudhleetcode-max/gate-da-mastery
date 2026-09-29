/**
 * npm run content:build            → validate + compile content into generated/content.json
 * npm run content:build -- --strict → also fail on any content error (used for production builds)
 * npm run content:validate         → validate only (exit 1 on errors)
 */
import fs from "node:fs";
import path from "node:path";
import { compileContent, type RawContent } from "../../src/lib/content/compile";

const ROOT = path.resolve(__dirname, "../..");
const C = (...p: string[]) => path.join(ROOT, "content", ...p);

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function readOptional(file: string): unknown | null {
  return fs.existsSync(file) ? readJson(file) : null;
}
function readDir(dir: string, recursive = false): { file: string; data: unknown }[] {
  if (!fs.existsSync(dir)) return [];
  const out: { file: string; data: unknown }[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && recursive) out.push(...readDir(full, true));
    else if (entry.isFile() && entry.name.endsWith(".json")) {
      const rel = path.relative(ROOT, full);
      try {
        out.push({ file: rel, data: readJson(full) });
      } catch (e) {
        out.push({ file: rel, data: { __invalid: (e as Error).message } });
      }
    }
  }
  return out;
}

export function loadRawContent(): RawContent {
  return {
    syllabus: readJson(C("syllabus.json")),
    sources: readJson(C("sources.json")),
    papers: readJson(C("exam", "papers.json")),
    pattern: readOptional(C("exam", "pattern.json")),
    pyqs: readDir(C("pyqs"), true),
    mockTests: readOptional(C("mocks", "tests.json")) ?? [],
    mockQuestionFiles: readDir(C("mocks", "questions")),
    practiceFiles: readDir(C("practice")),
    conceptFiles: readDir(C("concepts")),
    formulaFiles: readDir(C("formulas")),
    strategy: readOptional(C("strategy", "articles.json")),
    roadmap: readOptional(C("roadmap.json")),
  };
}

function main() {
  const validateOnly = process.argv.includes("--validate-only");
  const strict = process.argv.includes("--strict") || validateOnly;
  const t0 = Date.now();
  const raw = loadRawContent();
  const { bundle, issues } = compileContent(raw, {
    figureExists: (p) => p.startsWith("/") && fs.existsSync(path.join(ROOT, "public", p)),
  });
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const show = (xs: typeof issues, n: number) => xs.slice(0, n).forEach((i) => console.log(`  ${i.level.toUpperCase()} [${i.entity}] ${i.message}`));
  console.log(
    `content: ${bundle.questions.filter((q) => q.origin === "OFFICIAL_PYQ").length} PYQs, ` +
      `${bundle.questions.filter((q) => q.origin === "MOCK_TEST").length} mock questions in ${bundle.mocks.length} tests ` +
      `(${bundle.mocks.filter((m) => m.available).length} complete), ` +
      `${bundle.questions.filter((q) => q.origin === "ORIGINAL_PRACTICE").length} practice, ` +
      `${bundle.concepts.length} concepts, ${bundle.formulas.length} formulas, ${bundle.strategy.length} strategy articles`,
  );
  console.log(`issues: ${errors.length} error(s), ${warnings.length} warning(s)`);
  show(errors, 40);
  if (errors.length > 40) console.log(`  … ${errors.length - 40} more errors`);
  show(warnings, 15);
  if (!validateOnly) {
    fs.mkdirSync(path.join(ROOT, "generated"), { recursive: true });
    // Write atomically: readers (running servers) never see a half-written file.
    const target = path.join(ROOT, "generated", "content.json");
    const tmp = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(bundle));
    fs.renameSync(tmp, target);
    const kb = Math.round(fs.statSync(path.join(ROOT, "generated", "content.json")).size / 1024);
    console.log(`wrote generated/content.json (${kb} KB) in ${Date.now() - t0} ms`);
  }
  if (strict && errors.length) process.exit(1);
}

if (require.main === module) main();
