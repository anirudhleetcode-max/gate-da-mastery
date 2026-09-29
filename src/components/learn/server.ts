/**
 * Server-side data assembly for the learning pages (concepts, formula book,
 * strategy). Reads content through the repository and returns small,
 * serialisable props. Question lookups go through getQuestion(), so the
 * availability gate always applies.
 */
import "server-only";
import type { SubjectId } from "@/lib/content/schema";
import type { CompiledConcept, CompiledFormula, CompiledStrategy, QuestionMeta } from "@/lib/content/types";
import { getCatalog, getConcepts, getFormulas, getQuestion, getStrategy, getSubtopicName, getTopic, toMeta } from "@/lib/server/repo";
import { orderedSubjects } from "@/components/subject/server";
import { stemPreview } from "@/components/pyq/preview";
import { SUBJECT_SHORT } from "@/lib/labels";
import type { ConceptListItem, LibrarySubject, QuestionRow } from "./types";

export interface LearnTopic {
  id: string;
  name: string;
}

export interface LearnSubject {
  id: SubjectId;
  name: string;
  shortName: string;
  topics: LearnTopic[];
}

/** The 7 DA subjects in syllabus order, then General Aptitude. */
export function learnSubjects(): LearnSubject[] {
  return orderedSubjects().map((s) => ({ id: s.id, name: s.name, shortName: s.shortName, topics: s.topics.map((t) => ({ id: t.id, name: t.name })) }));
}

/** Rank of every topic in library order (subject order, then syllabus topic order). */
function topicRank(): Map<string, number> {
  const rank = new Map<string, number>();
  let i = 0;
  for (const s of learnSubjects()) for (const t of s.topics) rank.set(t.id, i++);
  return rank;
}

/** Items in library order: subject, then topic, then the order they are written in the content file. */
function libraryOrder<T extends { topicId: string }>(items: T[]): T[] {
  const rank = topicRank();
  return items
    .map((x, i) => ({ x, i }))
    .sort((a, b) => (rank.get(a.x.topicId) ?? 1e9) - (rank.get(b.x.topicId) ?? 1e9) || a.i - b.i)
    .map(({ x }) => x);
}

export function orderedConcepts(): CompiledConcept[] {
  return libraryOrder(getConcepts());
}

export function orderedFormulas(subjectId?: string): CompiledFormula[] {
  return libraryOrder(subjectId ? getFormulas().filter((f) => f.subjectId === subjectId) : getFormulas());
}

/** Official PYQ ids of a concept that students may see (servable, official). */
export function conceptPyqIds(c: CompiledConcept): string[] {
  return c.pyqIds.filter((id) => getQuestion(id)?.origin === "OFFICIAL_PYQ");
}

/**
 * A short plain-text summary of a concept from its definition HTML, with
 * formulas rendered as readable text ("P(A ∩ B)") rather than stripped LaTeX.
 */
export function conceptSummary(c: CompiledConcept, max = 180): string {
  return stemPreview(c.html.definition, max);
}

export function conceptListItems(): ConceptListItem[] {
  const subjectName = new Map(learnSubjects().map((s) => [s.id, s.name]));
  return orderedConcepts().map((c) => {
    const topicName = getTopic(c.topicId)?.name ?? c.topicId;
    return {
      id: c.id,
      title: c.title,
      subjectId: c.subjectId,
      topicId: c.topicId,
      supporting: !c.inOfficialSyllabus,
      pyqCount: conceptPyqIds(c).length,
      formulaCount: c.formulaIds.length,
      summary: conceptSummary(c),
      haystack: [c.title, topicName, ...c.subtopicIds.map(getSubtopicName), subjectName.get(c.subjectId), SUBJECT_SHORT[c.subjectId], stemPreview(`${c.html.definition} ${c.html.intuition}`, 700)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    };
  });
}

export function librarySubjects(): LibrarySubject[] {
  const catalog = getCatalog();
  const formulas = getFormulas();
  return learnSubjects().map((s) => ({
    id: s.id,
    name: s.name,
    topics: s.topics,
    formulaCount: formulas.filter((f) => f.subjectId === s.id).length,
    pyqCount: catalog.subjects.find((x) => x.id === s.id)?.pyqCount ?? 0,
  }));
}

/**
 * List rows for question ids, keeping only questions students may see.
 * Official PYQs are ordered newest paper first, then by question number.
 */
export function questionRows(ids: string[]): QuestionRow[] {
  const rows: QuestionRow[] = [];
  for (const id of new Set(ids)) {
    const q = getQuestion(id);
    if (!q) continue;
    const meta: QuestionMeta = toMeta(q);
    rows.push({ ...meta, preview: stemPreview(q.html.stem), topicName: getTopic(q.topicId)?.name ?? q.topicId });
  }
  return rows.sort((a, b) => {
    if (a.origin === "OFFICIAL_PYQ" && b.origin === "OFFICIAL_PYQ")
      return (b.year ?? 0) - (a.year ?? 0) || (b.session ?? 0) - (a.session ?? 0) || (a.questionNumber ?? 0) - (b.questionNumber ?? 0);
    return 0;
  });
}

/** Questions in the practice pool for a topic (servable PYQs + verified practice). */
export function topicPoolCount(topicId: string): number {
  const t = getCatalog().topics.find((x) => x.id === topicId);
  return t ? t.pyqCount + t.practiceCount : 0;
}

// ------------------------------------------------------------------ strategy

export const STRATEGY_SECTIONS: { id: CompiledStrategy["section"]; title: string; blurb: string }[] = [
  { id: "before", title: "Before the exam", blurb: "Planning, revision and getting ready for exam day." },
  { id: "during", title: "During the exam", blurb: "How to move through the paper and handle MCQ, MSQ and NAT questions." },
  { id: "time", title: "Time management", blurb: "Budgeting the 180 minutes across sections and passes." },
  { id: "after", title: "After a mock", blurb: "Turning a mock result into the next week's work." },
];

export const sectionTitle = (id: CompiledStrategy["section"]) => STRATEGY_SECTIONS.find((s) => s.id === id)?.title ?? id;

/** Articles of a section in their authored order (ties by title). */
export function sectionArticles(section: CompiledStrategy["section"]): CompiledStrategy[] {
  return getStrategy()
    .filter((a) => a.section === section)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

/** "timer" is a real route under /strategy, so no article may take that id. */
export const RESERVED_STRATEGY_IDS = new Set(["timer"]);
