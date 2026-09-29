/** Serialisable shapes the learning pages hand from server to client components. */
import type { SubjectId } from "@/lib/content/schema";
import type { QuestionMeta } from "@/lib/content/types";

export interface ConceptListItem {
  id: string;
  title: string;
  subjectId: SubjectId;
  topicId: string;
  /** true when the concept is not an explicit official-syllabus item. */
  supporting: boolean;
  /** Official PYQs linked to the concept that students may see. */
  pyqCount: number;
  formulaCount: number;
  summary: string;
  /** Lower-cased text the quick filter searches (title, topic, syllabus phrases, definition). */
  haystack: string;
}

export interface LibrarySubject {
  id: SubjectId;
  name: string;
  topics: { id: string; name: string }[];
  formulaCount: number;
  pyqCount: number;
}

/** A question in a list: metadata, a readable plain-text preview and its topic's name. */
export type QuestionRow = QuestionMeta & { topicName: string };

export interface RoadmapStageView {
  id: string;
  order: number;
  title: string;
  goal: string;
  activities: string[];
  exitCriteria: string[];
  links: { label: string; href: string }[];
}
