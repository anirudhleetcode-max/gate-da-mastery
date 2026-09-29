import type { Difficulty, MockTier, QuestionOrigin, QuestionType, SubjectId, VerificationStatus } from "@/lib/content/schema";

export const SUBJECT_ORDER: SubjectId[] = ["ps", "la", "co", "pdsa", "dbw", "ml", "ai", "ga"];

export const SUBJECT_SHORT: Record<SubjectId, string> = {
  ga: "General Aptitude",
  ps: "Probability & Statistics",
  la: "Linear Algebra",
  co: "Calculus & Optimization",
  pdsa: "Programming & DSA",
  dbw: "DBMS & Warehousing",
  ml: "Machine Learning",
  ai: "Artificial Intelligence",
};

export const SUBJECT_ABBR: Record<SubjectId, string> = {
  ga: "GA",
  ps: "P&S",
  la: "LA",
  co: "Calc",
  pdsa: "PDSA",
  dbw: "DBMS",
  ml: "ML",
  ai: "AI",
};

/** Categorical palette (validated light + dark; CSS variables in globals.css). Fixed order, never cycled. */
export const SUBJECT_COLOR: Record<SubjectId, string> = {
  ps: "var(--series-ps)",
  la: "var(--series-la)",
  co: "var(--series-co)",
  pdsa: "var(--series-pdsa)",
  dbw: "var(--series-dbw)",
  ml: "var(--series-ml)",
  ai: "var(--series-ai)",
  ga: "var(--series-ga)",
};

export const ORIGIN_LABEL: Record<QuestionOrigin, string> = {
  OFFICIAL_PYQ: "Official GATE PYQ",
  ORIGINAL_PRACTICE: "Original practice",
  MOCK_TEST: "Mock test",
};

export const TYPE_LABEL: Record<QuestionType, string> = {
  MCQ: "MCQ",
  MSQ: "MSQ",
  NAT: "NAT",
};

export const TYPE_HELP: Record<QuestionType, string> = {
  MCQ: "Multiple choice: exactly one option is correct.",
  MSQ: "Multiple select: one or more options are correct. There is no partial credit and no negative marking.",
  NAT: "Numerical answer type: enter a number. There is no negative marking.",
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  EASY: "Easy",
  MODERATE: "Moderate",
  HARD: "Hard",
  VERY_HARD: "Very hard",
};

export const DIFFICULTY_ORDER: Difficulty[] = ["EASY", "MODERATE", "HARD", "VERY_HARD"];

export const TIER_LABEL: Record<MockTier, string> = {
  FOUNDATION: "Foundation",
  BEGINNER_INTERMEDIATE: "Beginner → Intermediate",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  FULL_GATE: "Full GATE simulation",
};

export const TIER_RANGE: Record<MockTier, string> = {
  FOUNDATION: "Mocks 1–10",
  BEGINNER_INTERMEDIATE: "Mocks 11–20",
  INTERMEDIATE: "Mocks 21–30",
  ADVANCED: "Mocks 31–40",
  FULL_GATE: "Mocks 41–50",
};

export const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  VERIFIED: "Verified",
  PARTIALLY_VERIFIED: "Partially verified",
  NEEDS_REVIEW: "Needs review",
};

export const SLOT_LABEL: Record<string, string> = {
  FORENOON: "Forenoon",
  AFTERNOON: "Afternoon",
};
