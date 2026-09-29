import "server-only";
import type { CompiledQuestion, QuestionMeta } from "@/lib/content/types";
import { getConcept, getFormula, getPaper, getQuestion, getSource, getSubject, getSubtopicName, getTopic, toMeta } from "./repo";

export interface QuestionPayload extends Omit<CompiledQuestion, "fingerprint"> {
  subjectName: string;
  topicName: string;
  subtopicNames: string[];
  paper?: { id: string; examDate: string; session: number; slot: string; slotTime: string; organizingInstitute: string; scheduleStatus: string; scheduleNotes: string };
  sources: { id: string; name: string; url?: string; type: string; verificationStatus: string; verificationNotes: string }[];
  concepts: { id: string; title: string }[];
  formulas: { id: string; name: string; subjectId: string; html: string }[];
  similar: (QuestionMeta & { topicName: string })[];
}

export function buildPayload(q: CompiledQuestion): QuestionPayload {
  const { fingerprint: _fp, ...rest } = q;
  void _fp;
  const paper = q.paperId ? getPaper(q.paperId) : undefined;
  return {
    ...rest,
    subjectName: getSubject(q.subjectId)?.name ?? q.subjectId,
    topicName: getTopic(q.topicId)?.name ?? q.topicId,
    subtopicNames: q.subtopicIds.map(getSubtopicName),
    paper: paper
      ? {
          id: paper.id,
          examDate: paper.examDate,
          session: paper.session,
          slot: paper.slot,
          slotTime: paper.slotTime,
          organizingInstitute: paper.organizingInstitute,
          scheduleStatus: paper.scheduleStatus,
          scheduleNotes: paper.scheduleNotes,
        }
      : undefined,
    sources: q.sourceIds
      .map((id) => getSource(id))
      .filter(Boolean)
      .map((s) => ({ id: s!.id, name: s!.name, url: s!.url, type: s!.type, verificationStatus: s!.verificationStatus, verificationNotes: s!.verificationNotes })),
    concepts: q.conceptIds.map((id) => getConcept(id)).filter(Boolean).map((c) => ({ id: c!.id, title: c!.title })),
    formulas: q.formulaIds.map((id) => getFormula(id)).filter(Boolean).map((f) => ({ id: f!.id, name: f!.name, subjectId: f!.subjectId, html: f!.html.formula })),
    similar: q.similarIds
      .map((id) => getQuestion(id))
      .filter(Boolean)
      .map((s) => ({ ...toMeta(s!), topicName: getTopic(s!.topicId)?.name ?? s!.topicId })),
  };
}

/** Exam-mode paper: questions WITHOUT answers or solutions. */
export function buildPaperQuestion(q: CompiledQuestion) {
  return {
    id: q.id,
    subjectId: q.subjectId,
    topicId: q.topicId,
    type: q.type,
    marks: q.marks,
    section: q.section ?? "DA",
    questionNumber: q.questionNumber ?? 0,
    stem: q.html.stem,
    options: q.html.options,
  };
}
export type PaperQuestion = ReturnType<typeof buildPaperQuestion>;
