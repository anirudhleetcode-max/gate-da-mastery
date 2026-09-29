"use client";
import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { plural } from "@/lib/utils";
import { topicHref, type PanelProps } from "./common";

export function PracticePanel({ data, model, status }: PanelProps) {
  const s = data.subject;
  const practiceTotal = data.topics.reduce((a, t) => a + t.practiceCount, 0);
  const pool = data.pyqs.length + practiceTotal;
  const progress = new Map(model.topics.map((t) => [t.topicId, t]));

  if (!pool)
    return (
      <EmptyState title={`No ${s.name} questions are available for practice yet`} action={<ButtonLink href="/practice">Practice other subjects</ButtonLink>}>
        Practice sessions draw on official PYQs and original practice questions. None from this subject are in the question bank yet.
      </EmptyState>
    );

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Quick start" description={`A session of mixed ${s.name} questions: ${plural(data.pyqs.length, "official PYQ")} and ${plural(practiceTotal, "original practice question")} in the pool.`} />
        <CardBody className="flex flex-wrap gap-2">
          <ButtonLink href={`/practice?subject=${s.id}&count=10`} variant="primary">
            <Dumbbell aria-hidden className="h-4 w-4" /> Practice 10 questions
          </ButtonLink>
          {pool > 10 ? (
            <ButtonLink href={`/practice?subject=${s.id}&count=20`}>
              <Dumbbell aria-hidden className="h-4 w-4" /> Practice 20 questions
            </ButtonLink>
          ) : null}
        </CardBody>
      </Card>

      <section aria-labelledby="practice-topics-h">
        <h3 id="practice-topics-h" className="mb-2 text-base font-semibold text-fg">
          Practice one topic
        </h3>
        <ul className="overflow-hidden rounded-[var(--radius)] border border-border bg-surface">
          {data.topics.map((t) => {
            const n = t.pyqCount + t.practiceCount;
            const p = progress.get(t.id);
            return (
              <li key={t.id} className="flex flex-col gap-2 border-b border-border px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Link href={topicHref(s.id, t.id)} className="font-medium text-fg hover:underline">
                    {t.name}
                  </Link>
                  <p className="tnum text-xs text-fg-3">
                    {plural(t.pyqCount, "PYQ")} · {t.practiceCount} practice
                    {status === "ready" && p?.attempted ? ` · you have answered ${p.attempted}` : ""}
                  </p>
                </div>
                {n ? (
                  <ButtonLink href={`/practice?subject=${s.id}&topic=${t.id}`} size="sm" className="h-10 self-start sm:self-auto">
                    Practice<span className="sr-only"> {t.name}</span>
                  </ButtonLink>
                ) : (
                  <span className="text-xs text-fg-3">No questions for this topic yet</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
