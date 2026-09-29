/**
 * Types of the compiled content bundle (generated/content.json) consumed by
 * the server-side repository and serialised to client components.
 */
import type {
  Answer,
  AnswerVerification,
  Difficulty,
  ExamPaper,
  ExamPattern,
  MockTest,
  OptionLabel,
  QuestionOrigin,
  QuestionType,
  RoadmapStage,
  Source,
  SubjectId,
  Syllabus,
  VerificationStatus,
} from "./schema";
import type { WeightageResult } from "@/lib/weightage/compute";

export interface QuestionHtml {
  stem: string;
  options: { label: OptionLabel; html: string }[];
  quick: string;
  steps: { title: string; html: string }[];
  finalAnswer: string;
  teaching?: string;
  optionAnalysis?: { label: OptionLabel; verdict: "correct" | "incorrect"; html: string }[];
  shortcut?: string;
  commonTrap?: string;
}

/** Metadata shared by all questions (no HTML) – small enough for list views. */
export interface QuestionMeta {
  id: string;
  origin: QuestionOrigin;
  subjectId: SubjectId;
  topicId: string;
  subtopicIds: string[];
  type: QuestionType;
  marks: number;
  difficulty: Difficulty;
  estimatedTimeSec: number;
  /** Plain-text preview of the stem (≤ 200 chars). */
  preview: string;
  // Official PYQ fields
  year?: number;
  paperId?: string;
  examDate?: string;
  session?: number;
  slot?: string;
  questionNumber?: number;
  section?: "GA" | "DA";
  // Mock fields
  testId?: string;
  /** Overall verification badge (the weakest of source / transcription / answer / solution). */
  verification: VerificationStatus;
}

export interface CompiledQuestion extends QuestionMeta {
  html: QuestionHtml;
  answer: Answer;
  difficultyRationale: string;
  concept?: string;
  conceptIds: string[];
  formulaIds: string[];
  similarIds: string[];
  officialKeyRaw?: string;
  officialImages?: string[];
  sourceIds: string[];
  transcription?: { status: VerificationStatus; notes: string };
  answerVerification: AnswerVerification;
  solutionStatus?: VerificationStatus;
  fingerprint: string;
}

export interface CompiledConcept {
  id: string;
  subjectId: SubjectId;
  topicId: string;
  subtopicIds: string[];
  title: string;
  inOfficialSyllabus: boolean;
  html: {
    definition: string;
    intuition: string;
    math: string;
    example: string;
    gateRelevance: string;
    commonMistakes: string[];
  };
  plain: string;
  formulaIds: string[];
  relatedConceptIds: string[];
  pyqIds: string[];
  practiceIds: string[];
}

export interface CompiledFormula {
  id: string;
  subjectId: SubjectId;
  topicId: string;
  name: string;
  latex: string;
  html: {
    formula: string;
    meaning: string;
    whenToUse: string;
    commonMistake: string;
    example: string;
    variables: { symbol: string; meaning: string }[];
  };
  plain: string;
  conceptIds: string[];
}

export interface CompiledStrategy {
  id: string;
  section: "before" | "during" | "time" | "after";
  title: string;
  summary: string;
  html: string;
  plain: string;
  order: number;
}

export interface SearchDoc {
  id: string;
  category: "pyq" | "concept" | "formula" | "mock" | "practice" | "topic" | "subject" | "strategy";
  title: string;
  text: string;
  href: string;
  subjectId?: string;
  year?: number;
}

export interface ContentIssue {
  level: "error" | "warning";
  entity: string;
  message: string;
}

export interface ContentBundle {
  version: string;
  builtAt: string;
  syllabus: Syllabus;
  sources: Source[];
  papers: ExamPaper[];
  pattern: ExamPattern | null;
  questions: CompiledQuestion[];
  mocks: (MockTest & { totalMarks: number; available: boolean })[];
  concepts: CompiledConcept[];
  formulas: CompiledFormula[];
  strategy: CompiledStrategy[];
  roadmap: RoadmapStage[];
  weightage: {
    all: WeightageResult;
    byPaper: Record<string, WeightageResult>;
  };
  searchDocs: SearchDoc[];
  issues: ContentIssue[];
}
