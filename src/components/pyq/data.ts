/**
 * Serialisable shapes the PYQ pages hand from server components to client
 * components, plus small pure helpers shared by both sides.
 */
import type { ExamPaper, Subject, SubjectId } from "@/lib/content/schema";
import { SLOT_LABEL } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

export interface PaperInfo {
  id: string;
  year: number;
  examDate: string;
  session: number;
  slot: string;
  slotTime: string;
  organizingInstitute: string;
  totalQuestions: number;
  totalMarks: number;
}

export interface TaxonomyTopic {
  id: string;
  name: string;
  subtopics: { id: string; name: string }[];
}

export interface TaxonomySubject {
  id: SubjectId;
  name: string;
  shortName: string;
  topics: TaxonomyTopic[];
}

export function toPaperInfo(p: ExamPaper): PaperInfo {
  return {
    id: p.id,
    year: p.year,
    examDate: p.examDate,
    session: p.session,
    slot: p.slot,
    slotTime: p.slotTime,
    organizingInstitute: p.organizingInstitute,
    totalQuestions: p.totalQuestions,
    totalMarks: p.totalMarks,
  };
}

/** Newest paper first (year, then session). */
export function sortPapersNewestFirst<T extends { year: number; session: number }>(papers: T[]): T[] {
  return [...papers].sort((a, b) => b.year - a.year || b.session - a.session);
}

export function toTaxonomy(subjects: Subject[]): TaxonomySubject[] {
  return [...subjects]
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      id: s.id,
      name: s.name,
      shortName: s.shortName,
      topics: s.topics.map((t) => ({ id: t.id, name: t.name, subtopics: t.subtopics.map((st) => ({ id: st.id, name: st.name })) })),
    }));
}

export const slotName = (slot: string) => SLOT_LABEL[slot] ?? slot;

/** "15 Feb 2026 · Session 8 · Afternoon" */
export function paperLabel(p: Pick<PaperInfo, "examDate" | "session" | "slot">): string {
  return `${formatDate(p.examDate)} · Session ${p.session} · ${slotName(p.slot)}`;
}

/** Same title format the question page uses, so bookmarks read identically everywhere. */
export function pyqTitle(m: { year?: number; questionNumber?: number }): string {
  return `GATE DA ${m.year} · Q.${m.questionNumber}`;
}

/** Official section ranges of a DA paper: GA is Q.1–Q.10, the subject section follows. */
export const GA_LAST_QUESTION = 10;
