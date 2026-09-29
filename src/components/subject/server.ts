/**
 * Server-side data assembly for the Subjects, Topic and Syllabus pages.
 * Reads content through the repository and returns small serialisable props.
 */
import "server-only";
import type { Subject, SubjectId } from "@/lib/content/schema";
import type { CompiledQuestion, QuestionMeta } from "@/lib/content/types";
import {
  getBundle,
  getCatalog,
  getConcepts,
  getFormulas,
  getMocks,
  getPapers,
  getPyqs,
  getSource,
  getSubject,
  getSubjects,
  getSyllabus,
  getWeightage,
  toMeta,
  topicStats,
} from "@/lib/server/repo";
import { SUBJECT_ORDER } from "@/lib/labels";
import { cleanPreview } from "@/components/pyq/preview";
import type { MockRef, SourceRef, SubjectCardData, SubjectPageData, SyllabusData, WeightageSummary } from "./types";

/** The 7 DA subjects in syllabus order, then General Aptitude. */
export function orderedSubjects(): Subject[] {
  const rank = (id: string) => {
    const i = SUBJECT_ORDER.indexOf(id as SubjectId);
    return i === -1 ? SUBJECT_ORDER.length : i;
  };
  return [...getSubjects()].sort((a, b) => rank(a.id) - rank(b.id) || a.order - b.order);
}

export function sourceRefs(ids: string[]): SourceRef[] {
  return ids
    .map((id) => getSource(id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .map((s) => ({ id: s.id, name: s.name, url: s.url, status: s.verificationStatus }));
}

const displayMeta = (q: CompiledQuestion): QuestionMeta => {
  const m = toMeta(q);
  return { ...m, preview: cleanPreview(m.preview) };
};

/** Historical per-paper figures for one subject, with question-bank completeness per paper. */
export function subjectWeightage(subjectId: string): WeightageSummary | null {
  const all = getWeightage()?.all;
  const w = all?.subjects.find((s) => s.subjectId === subjectId);
  if (!all || !w || w.totalPapers === 0) return null;
  const papers = getPapers();
  const pyqs = getPyqs();
  const rows = w.perPaper.map((pp) => {
    const paper = papers.find((p) => p.id === pp.paperId);
    return {
      paperId: pp.paperId,
      year: pp.year,
      session: paper?.session ?? 0,
      examDate: paper?.examDate ?? "",
      questions: pp.questions,
      marks: pp.marks,
      byType: pp.byType,
      paperLoaded: pyqs.filter((q) => q.paperId === pp.paperId).length,
      paperTotal: paper?.totalQuestions ?? 0,
    };
  });
  return {
    rows,
    marksMin: w.marksMin,
    marksMax: w.marksMax,
    marksMean: w.marksMean,
    questionsMin: w.questionsMin,
    questionsMax: w.questionsMax,
    marksCv: w.marksCv,
    variation: w.variation,
    papersAppeared: w.papersAppeared,
    totalPapers: w.totalPapers,
    confidenceNote: all.confidenceNote,
    loadedQuestions: rows.reduce((a, r) => a + r.paperLoaded, 0),
    paperQuestions: rows.reduce((a, r) => a + r.paperTotal, 0),
  };
}

export function subjectCards(): SubjectCardData[] {
  const qs = getBundle().questions;
  return orderedSubjects().map((s) => {
    const w = subjectWeightage(s.id);
    return {
      id: s.id,
      name: s.name,
      officialName: s.officialName,
      description: s.description,
      topicCount: s.topics.length,
      pyqCount: qs.filter((q) => q.origin === "OFFICIAL_PYQ" && q.subjectId === s.id).length,
      practiceCount: qs.filter((q) => q.origin === "ORIGINAL_PRACTICE" && q.subjectId === s.id).length,
      weightage: w ? { marksMin: w.marksMin, marksMax: w.marksMax, papers: w.totalPapers, variation: w.variation } : null,
    };
  });
}

export function mockRefs(): MockRef[] {
  return getMocks().map((m) => ({ id: m.id, number: m.number, title: m.title }));
}

export function subjectPageData(subjectId: string): SubjectPageData | null {
  const s = getSubject(subjectId);
  if (!s) return null;
  const stats = topicStats(s.id);
  const pyqs = getPyqs().filter((q) => q.subjectId === s.id);
  const subtopicPyqs = (id: string) => pyqs.filter((q) => q.subtopicIds.includes(id)).length;
  const topicIds = new Set(s.topics.map((t) => t.id));
  const topicOrder = (id: string) => s.topics.findIndex((t) => t.id === id);
  const mockQuestions = getBundle()
    .questions.filter((q) => q.origin === "MOCK_TEST" && q.subjectId === s.id && q.testId)
    .sort((a, b) => (a.testId ?? "").localeCompare(b.testId ?? "") || (a.questionNumber ?? 0) - (b.questionNumber ?? 0));
  const mockIds = new Set(mockQuestions.map((q) => q.testId));
  return {
    subject: {
      id: s.id,
      name: s.name,
      shortName: s.shortName,
      officialName: s.officialName,
      description: s.description,
      officialText: s.officialText,
      syllabusStatus: s.syllabusStatus,
      sources: sourceRefs(s.sourceIds),
    },
    topics: stats.map((st) => ({
      id: st.topic.id,
      name: st.topic.name,
      summary: st.topic.summary,
      subtopics: st.topic.subtopics.map((x) => ({ id: x.id, name: x.name, officialPhrase: x.officialPhrase, pyqCount: subtopicPyqs(x.id) })),
      pyqCount: st.pyqCount,
      practiceCount: st.practiceCount,
      mockCount: st.mockCount,
      conceptCount: st.conceptCount,
      formulaCount: st.formulaCount,
    })),
    weightage: subjectWeightage(s.id),
    pyqs: pyqs.map(displayMeta),
    papers: getPapers().map((p) => ({ id: p.id, year: p.year, session: p.session, examDate: p.examDate, slot: p.slot })),
    formulas: getFormulas()
      .filter((f) => f.subjectId === s.id)
      .sort((a, b) => topicOrder(a.topicId) - topicOrder(b.topicId))
      .map((f) => ({ id: f.id, name: f.name, topicId: f.topicId })),
    concepts: getConcepts()
      .filter((c) => c.subjectId === s.id && topicIds.has(c.topicId))
      .sort((a, b) => topicOrder(a.topicId) - topicOrder(b.topicId))
      .map((c) => ({ id: c.id, title: c.title, topicId: c.topicId })),
    mockQuestions: mockQuestions.map(displayMeta),
    mocks: mockRefs().filter((m) => mockIds.has(m.id)),
  };
}

export function syllabusData(): SyllabusData {
  const syl = getSyllabus();
  const qs = getBundle().questions;
  const catalog = getCatalog();
  const catSubject = new Map(catalog.subjects.map((s) => [s.id, s]));
  const catTopic = new Map(catalog.topics.map((t) => [t.id, t]));
  const subjects = orderedSubjects();
  const subtopicIds = subjects.flatMap((s) => s.topics.flatMap((t) => t.subtopics.map((x) => x.id)));
  const index = new Map(subtopicIds.map((id, i) => [id, i]));
  const questionSubtopics: Record<string, number[]> = {};
  const practiceBySubtopic = new Map<string, number>();
  for (const q of qs) {
    const idx = q.subtopicIds.map((id) => index.get(id)).filter((i): i is number => i !== undefined);
    if (idx.length) questionSubtopics[q.id] = idx;
    if (q.origin === "ORIGINAL_PRACTICE") for (const id of q.subtopicIds) practiceBySubtopic.set(id, (practiceBySubtopic.get(id) ?? 0) + 1);
  }
  return {
    examYear: syl.examYear,
    notes: syl.notes,
    subtopicIds,
    questionSubtopics,
    subjects: subjects.map((s) => ({
      id: s.id,
      name: s.name,
      officialName: s.officialName,
      officialText: s.officialText,
      syllabusStatus: s.syllabusStatus,
      sources: sourceRefs(s.sourceIds),
      pyqCount: catSubject.get(s.id)?.pyqCount ?? 0,
      practiceCount: catSubject.get(s.id)?.practiceCount ?? 0,
      topics: s.topics.map((t) => {
        const ct = catTopic.get(t.id);
        return {
          id: t.id,
          name: t.name,
          summary: t.summary,
          pyqCount: ct?.pyqCount ?? 0,
          practiceCount: ct?.practiceCount ?? 0,
          subtopics: t.subtopics.map((x) => ({
            id: x.id,
            name: x.name,
            officialPhrase: x.officialPhrase,
            pyqCount: ct?.subtopics.find((cs) => cs.id === x.id)?.pyqCount ?? 0,
            practiceCount: practiceBySubtopic.get(x.id) ?? 0,
          })),
        };
      }),
    })),
  };
}
