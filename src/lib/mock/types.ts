/**
 * Shared types for the mock-test engine (list, intro, exam, results).
 *
 * The API routes are the contract between the server and the exam client:
 *  - `/api/mocks/[id]/paper` → {@link PaperResponse} (NO answers or solutions)
 *  - `/api/mocks/[id]/key`   → {@link KeyResponse}   (fetched only after submission)
 */
import type { ContentBundle } from "@/lib/content/types";
import type { PaperQuestion, QuestionPayload } from "@/lib/server/payload";

/** A mock-test definition as compiled into the content bundle. */
export type MockTestDef = ContentBundle["mocks"][number];

export type { PaperQuestion };

export interface PaperResponse {
  test: MockTestDef;
  questions: PaperQuestion[];
}

export interface KeyResponse {
  test: MockTestDef;
  questions: QuestionPayload[];
}

/** Optional self-reported confidence for a response. */
export type Confidence = "high" | "medium" | "low";

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** Small, serialisable summary of a mock for list and intro pages (no question ids). */
export interface MockSummary {
  id: string;
  number: number;
  tier: MockTestDef["tier"];
  title: string;
  shortTitle: string;
  description: string;
  questionCount: number;
  /** Total marks, or null when the paper is incomplete and the total is not yet known. */
  totalMarks: number | null;
  durationMinutes: number;
  negativeMarking: boolean;
  available: boolean;
}
