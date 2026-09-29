"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { SubjectId } from "@/lib/content/schema";
import type { TopicProgress } from "@/lib/analytics/useProgress";
import type { Mastery } from "@/lib/analytics/stats";
import { SUBJECT_ABBR, SUBJECT_COLOR } from "@/lib/labels";
import { cn, formatDuration, pct } from "@/lib/utils";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";

type SortKey = "syllabus" | "name" | "attempted" | "accuracy" | "avgTime" | "pyq" | "mastery";
type Dir = "asc" | "desc";

const COLUMNS: { key: SortKey; label: string; numeric?: boolean; firstDir: Dir }[] = [
  { key: "name", label: "Topic", firstDir: "asc" },
  { key: "attempted", label: "Answers", numeric: true, firstDir: "desc" },
  { key: "accuracy", label: "Accuracy", numeric: true, firstDir: "asc" },
  { key: "avgTime", label: "Avg time", numeric: true, firstDir: "desc" },
  { key: "pyq", label: "PYQs attempted", numeric: true, firstDir: "asc" },
  { key: "mastery", label: "Your topic mastery", numeric: true, firstDir: "asc" },
];

function value(t: TopicProgress, key: SortKey): number | string | null {
  switch (key) {
    case "name":
      return t.name.toLowerCase();
    case "attempted":
      return t.attempted;
    case "accuracy":
      return t.accuracy;
    case "avgTime":
      return t.avgTimeMs;
    case "pyq":
      return t.pyqTotal ? t.pyqDone / t.pyqTotal : null;
    case "mastery":
      return t.mastery.score;
    default:
      return null;
  }
}

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "syllabus:asc", label: "Syllabus order" },
  { value: "mastery:asc", label: "Lowest mastery" },
  { value: "mastery:desc", label: "Highest mastery" },
  { value: "accuracy:asc", label: "Lowest accuracy" },
  { value: "accuracy:desc", label: "Highest accuracy" },
  { value: "attempted:desc", label: "Most answers" },
  { value: "attempted:asc", label: "Fewest answers" },
  { value: "avgTime:desc", label: "Slowest" },
  { value: "pyq:asc", label: "Least PYQ coverage" },
  { value: "name:asc", label: "Topic A–Z" },
];

const LEVEL_TONE: Record<Mastery["level"], "neutral" | "danger" | "warning" | "info" | "success"> = {
  "Not enough data": "neutral",
  "Needs work": "danger",
  Developing: "warning",
  Proficient: "info",
  Strong: "success",
};

/** Every topic with the student's attempts, accuracy, time, PYQ coverage and mastery; sortable and filterable by subject. */
export function TopicTable({ topics, subjects }: { topics: TopicProgress[]; subjects: { id: string; name: string }[] }) {
  const [subject, setSubject] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: Dir }>({ key: "syllabus", dir: "asc" });
  const order = useMemo(() => new Map(topics.map((t, i) => [t.topicId, i])), [topics]);
  const rows = useMemo(() => {
    const list = topics.filter((t) => !subject || t.subjectId === subject);
    if (sort.key === "syllabus") return list;
    return [...list].sort((a, b) => {
      const va = value(a, sort.key);
      const vb = value(b, sort.key);
      // Topics without data always sink to the bottom, whatever the direction.
      if (va === null && vb === null) return (order.get(a.topicId) ?? 0) - (order.get(b.topicId) ?? 0);
      if (va === null) return 1;
      if (vb === null) return -1;
      const c = typeof va === "string" ? va.localeCompare(vb as string) : va - (vb as number);
      return (sort.dir === "asc" ? c : -c) || (order.get(a.topicId) ?? 0) - (order.get(b.topicId) ?? 0);
    });
  }, [topics, subject, sort, order]);

  const sortValue = `${sort.key}:${sort.dir}`;
  const toggle = (key: SortKey, firstDir: Dir) =>
    setSort((s) => (s.key !== key ? { key, dir: firstDir } : s.dir === firstDir ? { key, dir: firstDir === "asc" ? "desc" : "asc" } : { key: "syllabus", dir: "asc" }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto">
          <Select label="Subject" id="topic-table-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="sm:w-64">
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select
            label="Sort by"
            id="topic-table-sort"
            value={SORT_OPTIONS.some((o) => o.value === sortValue) ? sortValue : "syllabus:asc"}
            onChange={(e) => {
              const [key, dir] = e.target.value.split(":") as [SortKey, Dir];
              setSort({ key, dir });
            }}
            className="sm:hidden"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <p className="text-xs text-fg-3" role="status">
          {rows.length} {rows.length === 1 ? "topic" : "topics"}
          {sort.key === "syllabus" ? " in syllabus order" : ""}.<span className="hidden sm:inline"> Select a column heading to sort;</span> topics without data stay at the bottom.
        </p>
      </div>

      {/* Phones: one stacked row per topic. */}
      <ul className="divide-y divide-border rounded-[var(--radius)] border border-border bg-surface sm:hidden" aria-label="Topic performance">
        {rows.map((t) => (
          <li key={t.topicId} className="px-3 py-2.5">
            <div className="flex items-start gap-2">
              <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: SUBJECT_COLOR[t.subjectId as SubjectId] }} />
              <Link href={`/subjects/${t.subjectId}/topics/${t.topicId}`} className="min-w-0 flex-1 text-sm font-medium text-fg hover:underline">
                {t.name}
              </Link>
              <span className="inline-flex shrink-0 items-center gap-1.5">
                {t.mastery.score !== null ? <span className="tnum text-sm font-semibold text-fg">{t.mastery.score}</span> : null}
                <Badge tone={LEVEL_TONE[t.mastery.level]}>{t.mastery.level}</Badge>
              </span>
            </div>
            <p className="tnum mt-0.5 pl-4 text-xs text-fg-3">
              {SUBJECT_ABBR[t.subjectId as SubjectId] ?? t.subjectId} ·{" "}
              {t.attempted ? `${t.attempted} ${t.attempted === 1 ? "answer" : "answers"} · ${pct(t.accuracy, 0)} · ${formatDuration(t.avgTimeMs)}` : "no answers yet"} · PYQs{" "}
              {t.pyqTotal ? `${t.pyqDone}/${t.pyqTotal}` : "none loaded"}
            </p>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-[var(--radius)] border border-border sm:block">
        <table className="w-full min-w-[44rem] text-sm">
          <caption className="sr-only">Topic performance: answers, accuracy, average time, PYQs attempted and your topic mastery for each topic</caption>
          <thead className="bg-surface-2">
            <tr className="text-left text-xs text-fg-3">
              {COLUMNS.map((c) => {
                const active = sort.key === c.key;
                const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
                return (
                  <th key={c.key} scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={cn("px-3 py-2 font-medium", c.numeric && "text-right")}>
                    <button
                      type="button"
                      onClick={() => toggle(c.key, c.firstDir)}
                      className={cn("inline-flex min-h-8 items-center gap-1 rounded hover:text-fg", active && "text-fg", c.numeric && "flex-row-reverse")}
                    >
                      {c.label}
                      <Icon aria-hidden className="h-3.5 w-3.5 opacity-70" />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.topicId} className="border-t border-border">
                <th scope="row" className="max-w-[18rem] px-3 py-2 text-left font-normal">
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: SUBJECT_COLOR[t.subjectId as SubjectId] }} />
                    <span className="min-w-0">
                      <Link href={`/subjects/${t.subjectId}/topics/${t.topicId}`} className="line-clamp-2 font-medium text-fg hover:underline">
                        {t.name}
                      </Link>
                      <span className="text-xs text-fg-3">{SUBJECT_ABBR[t.subjectId as SubjectId] ?? t.subjectId}</span>
                    </span>
                  </span>
                </th>
                <td className="tnum px-3 py-2 text-right text-fg-2">{t.attempted || "—"}</td>
                <td className="tnum px-3 py-2 text-right text-fg">{t.attempted ? `${pct(t.accuracy, 0)}` : "—"}</td>
                <td className="tnum px-3 py-2 text-right text-fg-2">{formatDuration(t.avgTimeMs)}</td>
                <td className="tnum px-3 py-2 text-right text-fg-2">{t.pyqTotal ? `${t.pyqDone}/${t.pyqTotal}` : "none loaded"}</td>
                <td className="px-3 py-2 text-right">
                  <span className="inline-flex items-center gap-2">
                    {t.mastery.score !== null ? <span className="tnum font-semibold text-fg">{t.mastery.score}</span> : null}
                    <Badge tone={LEVEL_TONE[t.mastery.level]}>{t.mastery.level}</Badge>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
