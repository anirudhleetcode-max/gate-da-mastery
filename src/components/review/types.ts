/** Serialisable props the review pages receive from their server components. */
import type { SubjectId } from "@/lib/content/schema";

export interface ReviewConcept {
  id: string;
  title: string;
  href: string;
  subjectId: SubjectId;
  topicId: string;
}

export interface ReviewFormula {
  id: string;
  name: string;
  subjectId: SubjectId;
  topicId: string;
  /** Build-time HTML of the formula (math placeholders, hydrated by RichHtml). */
  html: string;
}

export interface ReviewTaxonomy {
  subjects: { id: SubjectId; name: string; shortName: string }[];
  topics: { id: string; subjectId: SubjectId; name: string }[];
}

/** A topic among the top historical-marks topics of the official papers. */
export interface HighWeightTopic {
  topicId: string;
  subjectId: SubjectId;
  name: string;
  marks: number;
  questions: number;
  papersAppeared: number;
}
