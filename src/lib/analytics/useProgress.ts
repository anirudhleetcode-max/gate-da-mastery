"use client";
/**
 * One shared progress model so every page (dashboard, subjects, syllabus,
 * progress) computes accuracy, completion and mastery identically.
 */
import { useMemo } from "react";
import type { Catalog } from "@/lib/server/repo";
import type { AttemptRow, RevisionItemRow } from "@/lib/userdata/db";
import { useAttempts, useRevisionItems } from "@/lib/userdata/hooks";
import { accuracyStat, studyStreak, topicMastery, weakTopics, type AccuracyStat, type Mastery, type WeakTopic } from "./stats";
import { localDay } from "@/lib/userdata/db";

export interface TopicProgress extends AccuracyStat {
  topicId: string;
  subjectId: string;
  name: string;
  pyqTotal: number;
  pyqDone: number; // distinct PYQs attempted (correct or incorrect)
  mastery: Mastery;
  revisionDue: number;
  revisionItems: number;
}

export interface SubjectProgress extends AccuracyStat {
  subjectId: string;
  name: string;
  pyqTotal: number;
  pyqDone: number;
}

export interface ProgressModel {
  ready: boolean;
  attempts: AttemptRow[];
  overall: AccuracyStat & { questionsSolved: number; pyqDone: number; pyqTotal: number; streak: number; studyDays: number };
  subjects: SubjectProgress[];
  topics: TopicProgress[];
  weak: (WeakTopic & { name: string; subjectId: string })[];
  revisionDueToday: number;
}

export function buildProgressModel(catalog: Catalog, attempts: AttemptRow[], revision: RevisionItemRow[], now: Date): Omit<ProgressModel, "ready"> {
  const scored = attempts.filter((a) => a.status !== "not_scored");
  const pyqIds = new Set(Object.values(catalog.pyqIdsByTopic).flat());
  // "Done" = submitted (correct, incorrect, or a marks-to-all question), same rule as the PYQ pages.
  const doneIds = new Set(attempts.filter((a) => a.status === "correct" || a.status === "incorrect" || a.status === "not_scored").map((a) => a.questionId));
  const pyqDone = [...doneIds].filter((id) => pyqIds.has(id)).length;
  const today = localDay(now);
  const days = new Set(attempts.map((a) => a.day));
  const topicName = new Map(catalog.topics.map((t) => [t.id, t]));
  const topics: TopicProgress[] = catalog.topics.map((t) => {
    const rows = scored.filter((a) => a.topicId === t.id);
    const ids = catalog.pyqIdsByTopic[t.id] ?? [];
    const rev = revision.filter((r) => r.topicId === t.id);
    return {
      ...accuracyStat(rows),
      topicId: t.id,
      subjectId: t.subjectId,
      name: t.name,
      pyqTotal: ids.length,
      pyqDone: ids.filter((id) => doneIds.has(id)).length,
      mastery: topicMastery({ attempts: rows, pyqTotal: ids.length, revisionItems: rev, now }),
      revisionDue: rev.filter((r) => r.nextReview <= today).length,
      revisionItems: rev.length,
    };
  });
  const subjects: SubjectProgress[] = catalog.subjects.map((s) => {
    const ts = topics.filter((t) => t.subjectId === s.id);
    return {
      ...accuracyStat(scored.filter((a) => a.subjectId === s.id)),
      subjectId: s.id,
      name: s.name,
      pyqTotal: ts.reduce((a, t) => a + t.pyqTotal, 0),
      pyqDone: ts.reduce((a, t) => a + t.pyqDone, 0),
    };
  });
  return {
    attempts,
    overall: { ...accuracyStat(scored), questionsSolved: doneIds.size, pyqDone, pyqTotal: pyqIds.size, streak: studyStreak(days, today), studyDays: days.size },
    subjects,
    topics,
    weak: weakTopics(scored).map((w) => ({ ...w, name: topicName.get(w.topicId)?.name ?? w.topicId, subjectId: topicName.get(w.topicId)?.subjectId ?? "" })),
    revisionDueToday: revision.filter((r) => r.nextReview <= today).length,
  };
}

export function useProgressModel(catalog: Catalog): ProgressModel {
  const attempts = useAttempts();
  const revision = useRevisionItems();
  return useMemo(() => ({ ready: true, ...buildProgressModel(catalog, attempts, revision, new Date()) }), [catalog, attempts, revision]);
}
