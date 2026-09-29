/**
 * npm run content:freeze-pyqs -- --reason "why the frozen set is being re-opened"
 *   → content/exam/pyq-freeze.json
 *
 * Records, for every PYQ file, a SHA-256 of the file plus a manifest of the
 * fields that must never drift silently (id, paper, year, question number,
 * section, type, marks, answer, official key cell, source ids).
 * tests/pyq-dataset.test.ts checks the live dataset against it: count, ids,
 * missing or duplicate numbers, answers, source metadata and byte-level
 * mutation.
 *
 * Re-freezing is deliberate: if any frozen file changed, a --reason is
 * required and is appended to the freeze log together with the changed files.
 * Review the diff before committing.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const dir = path.join(ROOT, "content", "pyqs");
const out = path.join(ROOT, "content", "exam", "pyq-freeze.json");

export interface FrozenPyq {
  sha256: string;
  id: string;
  paperId: string;
  year: number;
  questionNumber: number;
  section: string;
  type: string;
  marks: number;
  answer: string;
  officialKeyRaw: string;
  sourceIds: string[];
}

export interface FreezeFile {
  frozenAt: string;
  count: number;
  papers: Record<string, number>;
  files: Record<string, FrozenPyq>;
  log: { at: string; reason: string; changed: string[] }[];
}

/** Canonical one-line form of an answer, independent of key order. */
export function canonicalAnswer(a: Record<string, unknown>): string {
  switch (a.kind) {
    case "MCQ":
      return `MCQ:${a.correct}`;
    case "MSQ":
      return `MSQ:${[...(a.correct as string[])].sort().join(";")}`;
    case "NAT":
      return `NAT:${a.min}..${a.max}`;
    default:
      return String(a.kind);
  }
}

export function snapshot(): Record<string, FrozenPyq> {
  const files: Record<string, FrozenPyq> = {};
  for (const year of fs.readdirSync(dir).sort()) {
    for (const f of fs.readdirSync(path.join(dir, year)).sort()) {
      if (!f.endsWith(".json")) continue;
      const buf = fs.readFileSync(path.join(dir, year, f));
      const q = JSON.parse(buf.toString("utf8"));
      files[`${year}/${f}`] = {
        sha256: crypto.createHash("sha256").update(buf).digest("hex"),
        id: q.id,
        paperId: q.paperId,
        year: q.year,
        questionNumber: q.questionNumber,
        section: q.section,
        type: q.type,
        marks: q.marks,
        answer: canonicalAnswer(q.answer),
        officialKeyRaw: q.officialKeyRaw,
        sourceIds: q.sourceIds,
      };
    }
  }
  return files;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const i = args.indexOf("--reason");
  const reason = i >= 0 ? args[i + 1] ?? "" : "";
  const prev: Partial<FreezeFile> | null = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : null;
  const files = snapshot();

  const prevHash = (rel: string) => {
    const e = prev?.files?.[rel] as FrozenPyq | string | undefined;
    return typeof e === "string" ? e : e?.sha256;
  };
  const changed = Object.keys({ ...(prev?.files ?? {}), ...files })
    .filter((rel) => prevHash(rel) !== files[rel]?.sha256)
    .sort();
  if (prev?.files && changed.length && !reason.trim()) {
    console.error(`Refusing to re-freeze: ${changed.length} frozen PYQ file(s) changed:\n  ${changed.join("\n  ")}\nPass --reason "…" to record a deliberate correction.`);
    process.exit(1);
  }

  const papers: Record<string, number> = {};
  for (const e of Object.values(files)) papers[e.paperId] = (papers[e.paperId] ?? 0) + 1;
  const now = new Date().toISOString();
  const log = [...(prev?.log ?? [])];
  if (prev?.files && !prev.log) log.push({ at: prev.frozenAt ?? now, reason: "initial freeze (hash-only manifest)", changed: [] });
  if (!prev?.files) log.push({ at: now, reason: reason || "initial freeze", changed: [] });
  else if (changed.length) log.push({ at: now, reason, changed });
  else if (reason) log.push({ at: now, reason, changed: [] });

  const data: FreezeFile = { frozenAt: changed.length || !prev ? now : (prev.frozenAt ?? now), count: Object.keys(files).length, papers, files, log };
  fs.writeFileSync(out, JSON.stringify(data, null, 1) + "\n");
  console.log(`froze ${data.count} PYQ files (${changed.length} changed since the previous freeze)`);
}
