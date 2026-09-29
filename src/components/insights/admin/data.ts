/**
 * Admin-only data: content inventory over the WHOLE compiled bundle
 * (including questions hidden from students by the availability gate) and a
 * question-id → source-file index. Never import from student-facing pages.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { getBundle, getQuestion } from "@/lib/server/repo";
import type { CompiledQuestion } from "@/lib/content/types";
import type { QuestionOrigin, SubjectId, VerificationStatus } from "@/lib/content/schema";

export type ReviewStatus = NonNullable<CompiledQuestion["reviewStatus"]>;
export const ORIGINS: QuestionOrigin[] = ["OFFICIAL_PYQ", "ORIGINAL_PRACTICE", "MOCK_TEST"];
export const VERIFICATIONS: VerificationStatus[] = ["VERIFIED", "PARTIALLY_VERIFIED", "NEEDS_REVIEW"];
export const REVIEW_STATUSES: ReviewStatus[] = ["DRAFT", "SELF_CHECKED", "VERIFIED", "NEEDS_REVIEW"];

export interface AdminRow {
  id: string;
  origin: QuestionOrigin;
  subjectId: SubjectId;
  topicId: string;
  type: string;
  marks: number;
  verification: VerificationStatus;
  reviewStatus?: ReviewStatus;
  testId?: string;
  year?: number;
  questionNumber?: number;
  preview: string;
  /** Visible to students (passes the availability gate). */
  servable: boolean;
  /** Official PYQ with a formally resolved dispute record. */
  dispute: boolean;
  /** Official PYQ whose independent re-solve disagrees with the key (no dispute record yet). */
  disagrees: boolean;
}

export function adminRows(): AdminRow[] {
  return getBundle().questions.map((q) => ({
    id: q.id,
    origin: q.origin,
    subjectId: q.subjectId,
    topicId: q.topicId,
    type: q.type,
    marks: q.marks,
    verification: q.verification,
    reviewStatus: q.reviewStatus,
    testId: q.testId,
    year: q.year,
    questionNumber: q.questionNumber,
    preview: q.preview,
    servable: getQuestion(q.id) !== undefined,
    dispute: q.origin === "OFFICIAL_PYQ" && Boolean(q.dispute),
    disagrees: q.origin === "OFFICIAL_PYQ" && !q.dispute && !q.answerVerification.agreesWithKey,
  }));
}

// ------------------------------------------------------------------ question → file index

let cache: { signature: string; index: Map<string, string> } | null = null;

function jsonFiles(dirRel: string): string[] {
  const dir = path.join(process.cwd(), dirRel);
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".json") && !e.name.startsWith("."))
      .map((e) => `${dirRel}/${e.name}`)
      .sort();
  } catch {
    return [];
  }
}

/**
 * Map every original (mock / practice) question id to the file that holds it,
 * and every PYQ id to its conventional path. Re-read when a file changes.
 */
export function questionFileIndex(): Map<string, string> {
  const files = [...jsonFiles("content/mocks/questions"), ...jsonFiles("content/practice")];
  const signature = files
    .map((f) => {
      try {
        const st = fs.statSync(path.join(process.cwd(), f));
        return `${f}:${st.mtimeMs}:${st.size}`;
      } catch {
        return f;
      }
    })
    .join("|");
  if (cache && cache.signature === signature) return cache.index;
  const index = new Map<string, string>();
  for (const f of files) {
    try {
      const arr = JSON.parse(fs.readFileSync(path.join(process.cwd(), f), "utf8")) as { id?: unknown }[];
      if (Array.isArray(arr)) for (const q of arr) if (typeof q?.id === "string") index.set(q.id, f);
    } catch {
      /* an invalid file is reported by the build; it simply has no index entries */
    }
  }
  for (const q of getBundle().questions) {
    if (q.origin === "OFFICIAL_PYQ" && q.year) index.set(q.id, `content/pyqs/${q.year}/${q.id}.json`);
  }
  cache = { signature, index };
  return index;
}

/**
 * builtAt of generated/content.json as it is on disk now (read from the first
 * bytes of the file), or null. The server loads the bundle once per process,
 * so this can be newer than the bundle being served.
 */
export function diskBundleBuiltAt(): string | null {
  let fd: number | null = null;
  try {
    fd = fs.openSync(path.join(process.cwd(), "generated", "content.json"), "r");
    const buf = Buffer.alloc(512);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    return buf.toString("utf8", 0, n).match(/"builtAt":"([^"]+)"/)?.[1] ?? null;
  } catch {
    return null;
  } finally {
    if (fd !== null) fs.closeSync(fd);
  }
}

export function editHref(file: string): string {
  return `/admin/edit?file=${encodeURIComponent(file)}`;
}
