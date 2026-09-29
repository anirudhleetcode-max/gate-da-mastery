/**
 * Serialisable shapes the subject, topic and syllabus pages hand from server
 * components to client components. Content only: user data is never part of
 * these props (it is read on the client from the local database).
 */
import type { SubjectId, VerificationStatus } from "@/lib/content/schema";
import type { QuestionMeta } from "@/lib/content/types";
import type { Variation } from "@/lib/weightage/compute";

export interface SourceRef {
  id: string;
  name: string;
  url?: string;
  status: VerificationStatus;
}

/** One official paper's figures for a subject (historical, from classified PYQs). */
export interface WeightagePaperRow {
  paperId: string;
  year: number;
  session: number;
  examDate: string;
  questions: number;
  marks: number;
  byType: { MCQ: number; MSQ: number; NAT: number };
  /** Questions of this paper (all subjects) that are in the question bank, and the paper's official total. */
  paperLoaded: number;
  paperTotal: number;
}

export interface WeightageSummary {
  rows: WeightagePaperRow[];
  marksMin: number;
  marksMax: number;
  marksMean: number;
  questionsMin: number;
  questionsMax: number;
  marksCv: number | null;
  variation: Variation;
  papersAppeared: number;
  totalPapers: number;
  confidenceNote: string;
  /** Question-bank completeness across the papers the figures are based on. */
  loadedQuestions: number;
  paperQuestions: number;
}

export interface SubjectCardData {
  id: SubjectId;
  name: string;
  officialName: string;
  description: string;
  topicCount: number;
  pyqCount: number;
  practiceCount: number;
  weightage: { marksMin: number; marksMax: number; papers: number; variation: Variation } | null;
}

export interface SubtopicInfo {
  id: string;
  name: string;
  officialPhrase: string;
  /** Official PYQs tagged with this syllabus phrase, under any topic (the catalog definition). */
  pyqCount: number;
}

export interface TopicInfo {
  id: string;
  name: string;
  summary: string;
  subtopics: SubtopicInfo[];
  pyqCount: number;
  practiceCount: number;
  mockCount: number;
  conceptCount: number;
  formulaCount: number;
}

export interface PaperRef {
  id: string;
  year: number;
  session: number;
  examDate: string;
  slot: string;
}

export interface MockRef {
  id: string;
  number: number;
  title: string;
  /** False while the mock is still in review: it cannot be taken yet. */
  available: boolean;
}

export interface SubjectPageData {
  subject: {
    id: SubjectId;
    name: string;
    shortName: string;
    officialName: string;
    description: string;
    officialText: string;
    syllabusStatus: VerificationStatus;
    sources: SourceRef[];
  };
  topics: TopicInfo[];
  weightage: WeightageSummary | null;
  /** This subject's official PYQs (newest paper first), previews cleaned for display. */
  pyqs: QuestionMeta[];
  papers: PaperRef[];
  formulas: { id: string; name: string; topicId: string }[];
  concepts: { id: string; title: string; topicId: string }[];
  /** This subject's mock-test questions; the client shows only those from mocks the student has submitted. */
  mockQuestions: QuestionMeta[];
  mocks: MockRef[];
}

// ------------------------------------------------------------------ syllabus

export interface SyllabusSubtopic {
  id: string;
  name: string;
  officialPhrase: string;
  /** Official PYQs tagged with this syllabus phrase, under any topic (the catalog definition). */
  pyqCount: number;
  practiceCount: number;
}

export interface SyllabusTopic {
  id: string;
  name: string;
  summary: string;
  pyqCount: number;
  practiceCount: number;
  subtopics: SyllabusSubtopic[];
}

export interface SyllabusSubject {
  id: SubjectId;
  name: string;
  officialName: string;
  officialText: string;
  syllabusStatus: VerificationStatus;
  sources: SourceRef[];
  pyqCount: number;
  practiceCount: number;
  topics: SyllabusTopic[];
}

export interface SyllabusData {
  examYear: number;
  notes: string[];
  subjects: SyllabusSubject[];
  /** Flat list of every subtopic id; `questionSubtopics` refers to subtopics by index into it. */
  subtopicIds: string[];
  /** Question id → indexes of the subtopics it is tagged with (all origins), for subtopic-level progress. */
  questionSubtopics: Record<string, number[]>;
}
