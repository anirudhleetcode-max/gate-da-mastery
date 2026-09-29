/**
 * Server-side content repository. Loads generated/content.json once per
 * server process and builds in-memory indexes. Never import from client code.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import MiniSearch from "minisearch";
import type { CompiledConcept, CompiledFormula, CompiledQuestion, CompiledStrategy, ContentBundle, QuestionMeta, SearchDoc } from "@/lib/content/types";
import type { Subject, Topic } from "@/lib/content/schema";

interface Repo {
  bundle: ContentBundle;
  questionById: Map<string, CompiledQuestion>;
  conceptById: Map<string, CompiledConcept>;
  formulaById: Map<string, CompiledFormula>;
  strategyById: Map<string, CompiledStrategy>;
  subjectById: Map<string, Subject>;
  topicById: Map<string, Topic & { subjectId: string }>;
  subtopicName: Map<string, string>;
  search: MiniSearch<SearchDoc>;
}

let repo: Repo | null = null;

function load(): Repo {
  const file = path.join(process.cwd(), "generated", "content.json");
  if (!fs.existsSync(file)) {
    throw new Error("generated/content.json is missing. Run `npm run content:build` first.");
  }
  const bundle = JSON.parse(fs.readFileSync(file, "utf8")) as ContentBundle;
  const subjectById = new Map(bundle.syllabus.subjects.map((s) => [s.id, s]));
  const topicById = new Map<string, Topic & { subjectId: string }>();
  const subtopicName = new Map<string, string>();
  for (const s of bundle.syllabus.subjects)
    for (const t of s.topics) {
      topicById.set(t.id, { ...t, subjectId: s.id });
      for (const st of t.subtopics) subtopicName.set(st.id, st.name);
    }
  const search = new MiniSearch<SearchDoc>({
    fields: ["title", "text"],
    storeFields: ["id", "category", "title", "href", "subjectId", "year"],
    searchOptions: { boost: { title: 3 }, prefix: true, fuzzy: 0.15, combineWith: "AND" },
  });
  search.addAll(bundle.searchDocs);
  return {
    bundle,
    questionById: new Map(bundle.questions.map((q) => [q.id, q])),
    conceptById: new Map(bundle.concepts.map((c) => [c.id, c])),
    formulaById: new Map(bundle.formulas.map((f) => [f.id, f])),
    strategyById: new Map(bundle.strategy.map((s) => [s.id, s])),
    subjectById,
    topicById,
    subtopicName,
    search,
  };
}

export function getRepo(): Repo {
  if (!repo) repo = load();
  return repo;
}

// ------------------------------------------------------------------ helpers

export const getBundle = () => getRepo().bundle;
export const getSyllabus = () => getRepo().bundle.syllabus;
export const getSubjects = () => getRepo().bundle.syllabus.subjects;
export const getSubject = (id: string) => getRepo().subjectById.get(id);
export const getTopic = (id: string) => getRepo().topicById.get(id);
export const getSubtopicName = (id: string) => getRepo().subtopicName.get(id) ?? id;
export const getQuestion = (id: string) => getRepo().questionById.get(id);
export const getConcept = (id: string) => getRepo().conceptById.get(id);
export const getFormula = (id: string) => getRepo().formulaById.get(id);
export const getStrategyArticle = (id: string) => getRepo().strategyById.get(id);
export const getPapers = () => getRepo().bundle.papers;
export const getPaper = (id: string) => getRepo().bundle.papers.find((p) => p.id === id);
export const getSources = () => getRepo().bundle.sources;
export const getSource = (id: string) => getRepo().bundle.sources.find((s) => s.id === id);
export const getPattern = () => getRepo().bundle.pattern;
export const getMocks = () => getRepo().bundle.mocks;
export const getMock = (id: string) => getRepo().bundle.mocks.find((m) => m.id === id);
export const getConcepts = () => getRepo().bundle.concepts;
export const getFormulas = () => getRepo().bundle.formulas;
export const getStrategy = () => getRepo().bundle.strategy;
export const getRoadmap = () => getRepo().bundle.roadmap;
export const getWeightage = () => getRepo().bundle.weightage;

export function toMeta(q: CompiledQuestion): QuestionMeta {
  return {
    id: q.id,
    origin: q.origin,
    subjectId: q.subjectId,
    topicId: q.topicId,
    subtopicIds: q.subtopicIds,
    type: q.type,
    marks: q.marks,
    difficulty: q.difficulty,
    estimatedTimeSec: q.estimatedTimeSec,
    preview: q.preview,
    year: q.year,
    paperId: q.paperId,
    examDate: q.examDate,
    session: q.session,
    slot: q.slot,
    questionNumber: q.questionNumber,
    section: q.section,
    testId: q.testId,
    verification: q.verification,
  };
}

/** All official PYQs, newest paper first, then by question number. */
export function getPyqs(): CompiledQuestion[] {
  return getRepo()
    .bundle.questions.filter((q) => q.origin === "OFFICIAL_PYQ")
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || (b.session ?? 0) - (a.session ?? 0) || (a.questionNumber ?? 0) - (b.questionNumber ?? 0));
}

export const getPyqMetas = (): QuestionMeta[] => getPyqs().map(toMeta);

export function getPracticeQuestions(): CompiledQuestion[] {
  return getRepo().bundle.questions.filter((q) => q.origin === "ORIGINAL_PRACTICE");
}

export function getMockQuestions(testId: string): CompiledQuestion[] {
  const m = getMock(testId);
  if (!m) return [];
  const byId = getRepo().questionById;
  return m.questionIds.map((id) => byId.get(id)).filter((q): q is CompiledQuestion => Boolean(q));
}

/** Question metadata for every non-mock question (PYQ + practice) – used by Practice Now and Today. */
export function getPracticePoolMetas(): QuestionMeta[] {
  return getRepo().bundle.questions.filter((q) => q.origin !== "MOCK_TEST").map(toMeta);
}

/** Question metadata for every question (including mocks) – used by the client to label attempts. */
export function getAllMetas(): QuestionMeta[] {
  return getRepo().bundle.questions.map(toMeta);
}

export function searchContent(query: string, limit = 60) {
  const q = query.trim();
  if (q.length < 2) return [];
  const s = getRepo().search;
  let results = s.search(q);
  if (!results.length) results = s.search(q, { combineWith: "OR" });
  return results.slice(0, limit).map((r) => ({
    id: r.id as string,
    category: r.category as SearchDoc["category"],
    title: r.title as string,
    href: r.href as string,
    subjectId: r.subjectId as string | undefined,
    year: r.year as number | undefined,
    score: r.score,
  }));
}

/** Topics of a subject with official-PYQ counts. */
export function topicStats(subjectId: string) {
  const s = getSubject(subjectId);
  if (!s) return [];
  const qs = getRepo().bundle.questions;
  return s.topics.map((t) => ({
    topic: t,
    pyqCount: qs.filter((q) => q.origin === "OFFICIAL_PYQ" && q.topicId === t.id).length,
    practiceCount: qs.filter((q) => q.origin === "ORIGINAL_PRACTICE" && q.topicId === t.id).length,
    mockCount: qs.filter((q) => q.origin === "MOCK_TEST" && q.topicId === t.id).length,
    conceptCount: getRepo().bundle.concepts.filter((c) => c.topicId === t.id).length,
    formulaCount: getRepo().bundle.formulas.filter((f) => f.topicId === t.id).length,
  }));
}

export interface Catalog {
  subjects: { id: string; name: string; shortName: string; order: number; pyqCount: number; practiceCount: number; topicIds: string[] }[];
  topics: { id: string; subjectId: string; name: string; pyqCount: number; practiceCount: number; pyqMarks: number; subtopics: { id: string; name: string; pyqCount: number }[] }[];
  totals: { pyqs: number; practice: number; mocks: number; mockQuestions: number; papers: number };
  /** PYQ ids per topic (used for PYQ completion and mastery coverage). */
  pyqIdsByTopic: Record<string, string[]>;
}

/** Compact, serialisable taxonomy + counts for client-side analytics. */
export function getCatalog(): Catalog {
  const b = getRepo().bundle;
  const qs = b.questions;
  const pyqIdsByTopic: Record<string, string[]> = {};
  for (const q of qs) if (q.origin === "OFFICIAL_PYQ") (pyqIdsByTopic[q.topicId] ??= []).push(q.id);
  return {
    subjects: b.syllabus.subjects.map((s) => ({
      id: s.id,
      name: s.name,
      shortName: s.shortName,
      order: s.order,
      pyqCount: qs.filter((q) => q.origin === "OFFICIAL_PYQ" && q.subjectId === s.id).length,
      practiceCount: qs.filter((q) => q.origin === "ORIGINAL_PRACTICE" && q.subjectId === s.id).length,
      topicIds: s.topics.map((t) => t.id),
    })),
    topics: b.syllabus.subjects.flatMap((s) =>
      s.topics.map((t) => ({
        id: t.id,
        subjectId: s.id,
        name: t.name,
        pyqCount: qs.filter((q) => q.origin === "OFFICIAL_PYQ" && q.topicId === t.id).length,
        practiceCount: qs.filter((q) => q.origin === "ORIGINAL_PRACTICE" && q.topicId === t.id).length,
        pyqMarks: qs.filter((q) => q.origin === "OFFICIAL_PYQ" && q.topicId === t.id).reduce((a, q) => a + q.marks, 0),
        subtopics: t.subtopics.map((st) => ({ id: st.id, name: st.name, pyqCount: qs.filter((q) => q.origin === "OFFICIAL_PYQ" && q.subtopicIds.includes(st.id)).length })),
      })),
    ),
    totals: {
      pyqs: qs.filter((q) => q.origin === "OFFICIAL_PYQ").length,
      practice: qs.filter((q) => q.origin === "ORIGINAL_PRACTICE").length,
      mocks: b.mocks.length,
      mockQuestions: qs.filter((q) => q.origin === "MOCK_TEST").length,
      papers: b.papers.length,
    },
    pyqIdsByTopic,
  };
}
