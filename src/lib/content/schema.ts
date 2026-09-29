/**
 * Content schema for the GATE DA platform.
 *
 * Every content file under `content/` is validated against these schemas by
 * `npm run content:build`. Rich text fields are Markdown with `$…$` / `$$…$$`
 * LaTeX math, GFM tables and fenced code blocks; they are pre-rendered to HTML
 * at build time.
 *
 * Data-integrity rules encoded here:
 *  - Every question carries an `origin` so an original question can never be
 *    presented as an official GATE question.
 *  - Official facts carry `sourceIds` and a verification status.
 *  - PYQ difficulty is always platform-estimated (GATE publishes no difficulty).
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

export const VerificationStatus = z.enum(["VERIFIED", "PARTIALLY_VERIFIED", "NEEDS_REVIEW"]);
export type VerificationStatus = z.infer<typeof VerificationStatus>;

export const QuestionType = z.enum(["MCQ", "MSQ", "NAT"]);
export type QuestionType = z.infer<typeof QuestionType>;

export const Difficulty = z.enum(["EASY", "MODERATE", "HARD", "VERY_HARD"]);
export type Difficulty = z.infer<typeof Difficulty>;

export const QuestionOrigin = z.enum(["OFFICIAL_PYQ", "ORIGINAL_PRACTICE", "MOCK_TEST"]);
export type QuestionOrigin = z.infer<typeof QuestionOrigin>;

export const OptionLabel = z.enum(["A", "B", "C", "D"]);
export type OptionLabel = z.infer<typeof OptionLabel>;

export const SubjectId = z.enum(["ga", "ps", "la", "co", "pdsa", "dbw", "ml", "ai"]);
export type SubjectId = z.infer<typeof SubjectId>;

const Markdown = z.string().min(1);
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const Slug = z.string().regex(/^[a-z0-9][a-z0-9.-]*$/, "lowercase slug");

// ---------------------------------------------------------------------------
// Sources & verification
// ---------------------------------------------------------------------------

export const SourceType = z.enum([
  "OFFICIAL_QUESTION_PAPER",
  "OFFICIAL_ANSWER_KEY",
  "OFFICIAL_SYLLABUS",
  "OFFICIAL_INFORMATION_BROCHURE",
  "OFFICIAL_WEBSITE",
  "OFFICIAL_SAMPLE_PAPER",
  "SECONDARY",
  "PLATFORM",
]);
export type SourceType = z.infer<typeof SourceType>;

export const Source = z.object({
  id: Slug,
  name: z.string().min(1),
  type: SourceType,
  publisher: z.string().min(1),
  /** Canonical official URL (may be unreachable from some networks). */
  url: z.string().url().optional(),
  /** Where the bytes we actually inspected came from, when not the official URL. */
  retrievedFrom: z.string().optional(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  verificationDate: IsoDate,
  verificationStatus: VerificationStatus,
  /** How the status was reached, in plain language. Shown on the Sources page. */
  verificationNotes: z.string().min(1),
});
export type Source = z.infer<typeof Source>;

export const VerificationRecord = z.object({
  id: z.string().min(1),
  entityType: z.enum(["source", "exam_paper", "exam_pattern", "syllabus", "pyq", "mock_question", "practice_question", "weightage"]),
  entityId: z.string().min(1),
  field: z.string().optional(),
  status: VerificationStatus,
  method: z.string().min(1),
  sourceIds: z.array(z.string()).default([]),
  date: IsoDate,
  notes: z.string().default(""),
});
export type VerificationRecord = z.infer<typeof VerificationRecord>;

/** A single officially-sourced fact with its evidence. */
export const VerifiedFact = z.object({
  id: Slug,
  label: z.string().min(1),
  value: z.string().min(1),
  status: VerificationStatus,
  sourceIds: z.array(z.string()).min(1),
  notes: z.string().default(""),
});
export type VerifiedFact = z.infer<typeof VerifiedFact>;

// ---------------------------------------------------------------------------
// Syllabus
// ---------------------------------------------------------------------------

export const Subtopic = z.object({
  id: Slug,
  name: z.string().min(1),
  /** Exact phrase from the official syllabus this subtopic represents. */
  officialPhrase: z.string().min(1),
});
export type Subtopic = z.infer<typeof Subtopic>;

export const Topic = z.object({
  id: Slug,
  subjectId: SubjectId,
  /** Platform grouping name (the official syllabus is a flat phrase list). */
  name: z.string().min(1),
  summary: z.string().min(1),
  subtopics: z.array(Subtopic).min(1),
});
export type Topic = z.infer<typeof Topic>;

export const Subject = z.object({
  id: SubjectId,
  name: z.string().min(1),
  shortName: z.string().min(1),
  /** Section heading exactly as printed in the official syllabus. */
  officialName: z.string().min(1),
  order: z.number().int(),
  description: z.string().min(1),
  /** Verbatim official syllabus text for the subject. */
  officialText: z.string().min(1),
  syllabusStatus: VerificationStatus,
  sourceIds: z.array(z.string()).min(1),
  topics: z.array(Topic).min(1),
});
export type Subject = z.infer<typeof Subject>;

export const Syllabus = z.object({
  examYear: z.number().int(),
  paperCode: z.literal("DA"),
  notes: z.array(z.string()).default([]),
  subjects: z.array(Subject).min(1),
});
export type Syllabus = z.infer<typeof Syllabus>;

// ---------------------------------------------------------------------------
// Exam papers & pattern
// ---------------------------------------------------------------------------

export const Slot = z.enum(["FORENOON", "AFTERNOON"]);
export type Slot = z.infer<typeof Slot>;

export const ExamPaper = z.object({
  id: z.string().regex(/^DA-\d{4}-S\d+$/),
  year: z.number().int().min(2024),
  paperCode: z.literal("DA"),
  paperName: z.string().min(1),
  organizingInstitute: z.string().min(1),
  examDate: IsoDate,
  session: z.number().int().positive(),
  slot: Slot,
  slotTime: z.string().min(1),
  durationMinutes: z.number().int().positive(),
  totalQuestions: z.number().int().positive(),
  totalMarks: z.number().positive(),
  questionPaperSourceId: z.string(),
  answerKeySourceId: z.string(),
  /** Status of the date/session/slot facts specifically. */
  scheduleStatus: VerificationStatus,
  scheduleNotes: z.string().min(1),
  scheduleSourceIds: z.array(z.string()).min(1),
});
export type ExamPaper = z.infer<typeof ExamPaper>;

export const ExamPattern = z.object({
  facts: z.array(VerifiedFact).min(1),
  marking: z.object({
    mcqNegativeFraction: z.number(), // fraction of the question's marks deducted for a wrong MCQ
    msqNegative: z.number(),
    natNegative: z.number(),
    msqPartialCredit: z.boolean(),
    status: VerificationStatus,
    sourceIds: z.array(z.string()).min(1),
  }),
});
export type ExamPattern = z.infer<typeof ExamPattern>;

// ---------------------------------------------------------------------------
// Questions (shared parts)
// ---------------------------------------------------------------------------

export const Option = z.object({ label: OptionLabel, text: Markdown });
export type Option = z.infer<typeof Option>;

export const Answer = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("MCQ"), correct: OptionLabel }),
  z.object({ kind: z.literal("MSQ"), correct: z.array(OptionLabel).min(1) }),
  z.object({ kind: z.literal("NAT"), min: z.number(), max: z.number() }),
  /** Official key awarded "Marks To All" – the question is not scored. */
  z.object({ kind: z.literal("MTA"), note: z.string().min(1) }),
]);
export type Answer = z.infer<typeof Answer>;

export const SolutionStep = z.object({ title: z.string().min(1), body: Markdown });
export type SolutionStep = z.infer<typeof SolutionStep>;

export const OptionAnalysis = z.object({
  label: OptionLabel,
  verdict: z.enum(["correct", "incorrect"]),
  explanation: Markdown,
});
export type OptionAnalysis = z.infer<typeof OptionAnalysis>;

export const Solution = z.object({
  /** 2–4 line summary. */
  quick: Markdown,
  /** Complete derivation (default view). */
  steps: z.array(SolutionStep).min(2),
  finalAnswer: Markdown,
  /** First-principles explanation for a student who has forgotten the topic. */
  teaching: Markdown.optional(),
  optionAnalysis: z.array(OptionAnalysis).optional(),
  shortcut: Markdown.optional(),
  commonTrap: Markdown.optional(),
});
export type Solution = z.infer<typeof Solution>;

export const AnswerVerification = z.object({
  status: VerificationStatus,
  /** e.g. "Independent re-solve + Python check agrees with official key". */
  method: z.string().min(1),
  independentAnswer: z.string().optional(),
  agreesWithKey: z.boolean(),
  checkCode: z.string().optional(),
  notes: z.string().default(""),
});
export type AnswerVerification = z.infer<typeof AnswerVerification>;

const QuestionBase = z.object({
  id: z.string().min(1),
  subjectId: SubjectId,
  topicId: Slug,
  subtopicIds: z.array(Slug).min(1),
  type: QuestionType,
  marks: z.number().positive(),
  difficulty: Difficulty,
  difficultyRationale: z.string().min(1),
  stem: Markdown,
  options: z.array(Option).default([]),
  answer: Answer,
  solution: Solution,
  conceptIds: z.array(Slug).default([]),
  formulaIds: z.array(Slug).default([]),
  estimatedTimeSec: z.number().int().positive(),
});

// ---------------------------------------------------------------------------
// Official PYQs
// ---------------------------------------------------------------------------

export const Pyq = QuestionBase.extend({
  id: z.string().regex(/^DA\d{4}-S\d+-Q\d{2}$/),
  origin: z.literal("OFFICIAL_PYQ"),
  paperId: z.string(),
  year: z.number().int(),
  questionNumber: z.number().int().min(1).max(65),
  section: z.enum(["GA", "DA"]),
  /** The official key cell verbatim, e.g. "A;C", "0.12 to 0.13", "MTA". */
  officialKeyRaw: z.string().min(1),
  /** Rendered crops of the official paper region (public paths) for side-by-side checking. */
  officialImages: z.array(z.string()).default([]),
  sourceIds: z.array(z.string()).min(2),
  transcription: z.object({
    status: VerificationStatus,
    notes: z.string().default(""),
  }),
  answerVerification: AnswerVerification,
  solutionStatus: VerificationStatus,
});
export type Pyq = z.infer<typeof Pyq>;

// ---------------------------------------------------------------------------
// Original questions (mock + practice)
// ---------------------------------------------------------------------------

/**
 * Review pipeline for original (mock/practice) questions:
 *   DRAFT → SELF_CHECKED (author's computational check) → independent solve +
 *   answer comparison + solution review (agent) → duplicate + metadata checks
 *   (deterministic, scripts/content/mock-review.ts) → VERIFIED | NEEDS_REVIEW.
 * Only VERIFIED questions count as verified or appear in available mocks.
 */
export const ReviewStatus = z.enum(["DRAFT", "SELF_CHECKED", "VERIFIED", "NEEDS_REVIEW"]);
export type ReviewStatus = z.infer<typeof ReviewStatus>;

export const ReviewRecord = z.object({
  status: ReviewStatus,
  /** Individual gate results, e.g. { independentSolve: true, duplicate: true, metadata: true }. */
  checks: z.record(z.string(), z.boolean()),
  /** true when the independent verifier changed the question/answer/solution. */
  fixed: z.boolean(),
  notes: z.string().default(""),
  reviewedAt: IsoDate,
});
export type ReviewRecord = z.infer<typeof ReviewRecord>;

export const OriginalQuestion = QuestionBase.extend({
  origin: z.enum(["ORIGINAL_PRACTICE", "MOCK_TEST"]),
  review: ReviewRecord.optional(),
  sourceType: z.literal("PLATFORM_CREATED"),
  testId: z.string().optional(),
  questionNumber: z.number().int().positive().optional(),
  section: z.enum(["GA", "DA"]).default("DA"),
  concept: z.string().min(1),
  answerVerification: AnswerVerification,
});
export type OriginalQuestion = z.infer<typeof OriginalQuestion>;

export const MockTier = z.enum(["FOUNDATION", "BEGINNER_INTERMEDIATE", "INTERMEDIATE", "ADVANCED", "FULL_GATE"]);
export type MockTier = z.infer<typeof MockTier>;

export const MockTest = z.object({
  id: z.string().regex(/^mock-\d{2}$/),
  number: z.number().int().min(1).max(50),
  tier: MockTier,
  title: z.string().min(1),
  description: z.string().min(1),
  durationMinutes: z.number().int().positive(),
  negativeMarking: z.boolean(),
  questionIds: z.array(z.string()).min(1),
});
export type MockTest = z.infer<typeof MockTest>;

// ---------------------------------------------------------------------------
// Learning content
// ---------------------------------------------------------------------------

export const Formula = z.object({
  id: Slug,
  subjectId: SubjectId,
  topicId: Slug,
  name: z.string().min(1),
  /** LaTeX (display math, without surrounding $$). */
  latex: z.string().min(1),
  meaning: Markdown,
  variables: z.array(z.object({ symbol: z.string().min(1), meaning: z.string().min(1) })).default([]),
  whenToUse: Markdown,
  commonMistake: Markdown,
  example: Markdown,
  conceptIds: z.array(Slug).default([]),
});
export type Formula = z.infer<typeof Formula>;

export const Concept = z.object({
  id: Slug,
  subjectId: SubjectId,
  topicId: Slug,
  subtopicIds: z.array(Slug).default([]),
  title: z.string().min(1),
  /** true when the concept maps directly to an official syllabus phrase. */
  inOfficialSyllabus: z.boolean(),
  definition: Markdown,
  intuition: Markdown,
  math: Markdown,
  example: Markdown,
  gateRelevance: Markdown,
  commonMistakes: z.array(Markdown).min(1),
  formulaIds: z.array(Slug).default([]),
  relatedConceptIds: z.array(Slug).default([]),
});
export type Concept = z.infer<typeof Concept>;

export const StrategyArticle = z.object({
  id: Slug,
  section: z.enum(["before", "during", "time", "after"]),
  title: z.string().min(1),
  summary: z.string().min(1),
  body: Markdown,
  order: z.number().int(),
});
export type StrategyArticle = z.infer<typeof StrategyArticle>;

export const RoadmapStage = z.object({
  id: Slug,
  order: z.number().int(),
  title: z.string().min(1),
  goal: z.string().min(1),
  activities: z.array(z.string()).min(1),
  exitCriteria: z.array(z.string()).min(1),
  links: z.array(z.object({ label: z.string(), href: z.string() })).default([]),
});
export type RoadmapStage = z.infer<typeof RoadmapStage>;
