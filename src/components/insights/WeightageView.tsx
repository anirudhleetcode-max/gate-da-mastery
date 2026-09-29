"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { WeightageResult } from "@/lib/weightage/compute";
import { Segmented } from "@/components/ui/Segmented";
import { Callout } from "@/components/ui/Callout";
import { Badge } from "@/components/ui/Badge";
import { BarList, ChartFrame, DataTable, GroupedColumns } from "@/components/charts/Charts";
import { SUBJECT_ABBR, SUBJECT_COLOR, SUBJECT_SHORT } from "@/lib/labels";
import type { SubjectId } from "@/lib/content/schema";
import { formatDate, pct } from "@/lib/utils";

export interface WeightageViewProps {
  all: WeightageResult;
  byPaper: Record<string, WeightageResult>;
  papers: { id: string; year: number; examDate: string; session: number; slot: string; loaded: number; total: number }[];
  subjects: { id: string; name: string; shortName: string; topics: { id: string; name: string }[] }[];
  typeMix: { paperId: string; year: number; questions: number; mcq: number; msq: number; nat: number; oneMark: number; twoMark: number }[];
  verification: { total: number; contentVerified: number; needsReview: number };
}

const ORD = ["var(--ord-1)", "var(--ord-2)", "var(--ord-3)"];

export function WeightageView({ all, byPaper, papers, subjects, typeMix, verification }: WeightageViewProps) {
  const sorted = [...papers].sort((a, b) => a.year - b.year);
  const [sel, setSel] = useState<string>("all");
  const data = sel === "all" ? all : byPaper[sel];
  const topicName = useMemo(() => new Map(subjects.flatMap((s) => s.topics.map((t) => [t.id, t.name] as const))), [subjects]);
  const subjectName = (id: string) => SUBJECT_SHORT[id as SubjectId] ?? id;
  const order = subjects.map((s) => s.id);
  const rows = [...data.subjects].sort((a, b) => order.indexOf(a.subjectId) - order.indexOf(b.subjectId));
  const n = data.papers.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Paper"
          value={sel}
          onChange={setSel}
          options={[{ value: "all", label: "All available years" }, ...sorted.map((p) => ({ value: p.id, label: String(p.year) }))]}
        />
        <p className="text-sm text-fg-3">
          {n === 1 ? "One paper" : `${n} papers`} · {data.totalMarks} marks · based on {verification.total} official questions ({verification.contentVerified} content-verified, {verification.needsReview} under review)
        </p>
      </div>

      <Callout tone="warning" title="Historical observation, not a prediction">
        {data.confidenceNote} GATE does not publish subject weightage; these numbers come from the platform&apos;s classification of each official question into its primary syllabus subject and topic. General Aptitude is fixed at 15 marks by the paper structure.
      </Callout>

      {sorted.some((p) => p.loaded < p.total) ? (
        <Callout tone="info" title="Incomplete paper data">
          {sorted.filter((p) => p.loaded < p.total).map((p) => `${p.year}: ${p.loaded}/${p.total} questions loaded`).join("; ")}.
        </Callout>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame
          title={sel === "all" ? "Marks by subject (all papers combined)" : `Marks by subject: GATE DA ${data.papers[0]?.year}`}
          description="Sum of the marks of questions classified under each subject."
          table={{ columns: ["Subject", "Marks", "Share"], rows: rows.map((s) => [subjectName(s.subjectId), s.perPaper.reduce((a, p) => a + p.marks, 0), pct(s.shareOfMarks)]) }}
        >
          <BarList
            ariaLabel="Marks by subject"
            data={rows.map((s) => {
              const m = s.perPaper.reduce((a, p) => a + p.marks, 0);
              return { key: s.subjectId, label: subjectName(s.subjectId), value: m, color: SUBJECT_COLOR[s.subjectId as SubjectId], display: `${m} (${pct(s.shareOfMarks, 0)})` };
            })}
          />
        </ChartFrame>

        <ChartFrame
          title="Year-by-year marks per subject"
          description="Each paper is shown separately; papers are never pooled."
          legend={sorted.map((p, i) => ({ label: String(p.year), color: ORD[i % ORD.length] }))}
          table={{ columns: ["Subject", ...sorted.map((p) => String(p.year))], rows: all.subjects.map((s) => [subjectName(s.subjectId), ...sorted.map((p) => s.perPaper.find((x) => x.paperId === p.id)?.marks ?? 0)]) }}
        >
          <GroupedColumns
            height={280}
            ariaLabel="Marks per subject in each year"
            categories={all.subjects.map((s) => SUBJECT_ABBR[s.subjectId as SubjectId] ?? s.subjectId)}
            series={sorted.map((p, i) => ({ key: p.id, label: String(p.year), color: ORD[i % ORD.length], values: all.subjects.map((s) => s.perPaper.find((x) => x.paperId === p.id)?.marks ?? 0) }))}
          />
        </ChartFrame>
      </div>

      <section aria-labelledby="subject-table" className="min-w-0 rounded-[var(--radius)] border border-border bg-surface p-4">
        <h2 id="subject-table" className="mb-1 font-semibold text-fg">
          Subject summary {sel === "all" ? "across papers" : `for ${data.papers[0]?.year}`}
        </h2>
        <p className="mb-3 text-sm text-fg-3">Ranges are min–max over the selected papers. Variation is the coefficient of variation of marks: Low &lt; 0.2 ≤ Medium &lt; 0.4 ≤ High.</p>
        <DataTable
          caption="Subject summary"
          columns={["Subject", "Appeared in", "Questions (range)", "Marks (range)", "Mean marks", "Variation", ...data.papers.map((p) => `${p.year} marks`)]}
          rows={rows.map((s) => [
            subjectName(s.subjectId),
            `${s.papersAppeared}/${s.totalPapers} papers`,
            s.questionsMin === s.questionsMax ? String(s.questionsMin) : `${s.questionsMin}–${s.questionsMax}`,
            s.marksMin === s.marksMax ? String(s.marksMin) : `${s.marksMin}–${s.marksMax}`,
            String(s.marksMean),
            s.variation,
            ...s.perPaper.map((p) => String(p.marks)),
          ])}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame
          title="Most frequent topics (by marks)"
          description="Top 15 topic groups across the selected papers."
          table={{ columns: ["Topic", "Subject", "Questions", "Marks", "Papers"], rows: data.topics.map((t) => [topicName.get(t.topicId) ?? t.topicId, subjectName(t.subjectId), t.questions, t.marks, `${t.papersAppeared}/${n}`]) }}
        >
          <BarList
            ariaLabel="Topic frequency by marks"
            data={data.topics.slice(0, 15).map((t) => ({ key: t.topicId, label: topicName.get(t.topicId) ?? t.topicId, value: t.marks, color: SUBJECT_COLOR[t.subjectId as SubjectId], display: `${t.marks}`, detail: `${t.questions} question(s), in ${t.papersAppeared}/${n} paper(s)` }))}
          />
        </ChartFrame>

        <section aria-labelledby="type-mix" className="min-w-0 rounded-[var(--radius)] border border-border bg-surface p-4">
          <h2 id="type-mix" className="mb-1 font-semibold text-fg">
            Question-type and marks mix per paper
          </h2>
          <p className="mb-3 text-sm text-fg-3">Counts come from the official answer keys.</p>
          <DataTable
            caption="Question types per paper"
            columns={["Paper", "Questions", "MCQ", "MSQ", "NAT", "1-mark", "2-mark"]}
            rows={typeMix.map((t) => [String(t.year), t.questions, t.mcq, t.msq, t.nat, t.oneMark, t.twoMark])}
          />
          <ul className="mt-4 space-y-1 text-sm text-fg-2">
            {sorted.map((p) => (
              <li key={p.id}>
                <Badge tone="outline">{p.year}</Badge> {formatDate(p.examDate)}, session {p.session} ({p.slot.toLowerCase()}) ·{" "}
                <Link className="text-accent-text underline" href={`/pyqs/papers/${p.id}`}>
                  view paper
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-[var(--radius)] border border-border bg-surface p-4 text-sm text-fg-2">
        <h2 className="mb-2 font-semibold text-fg">Methodology</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Computed only from the official GATE DA papers loaded on this platform (2024, 2025 and 2026), whose answers are cross-checked against the official keys.</li>
          <li>Each question is counted once, under its primary syllabus subject and topic; questions spanning two topics are not split.</li>
          <li>With only {sorted.length} papers, one or two questions moving between subjects changes the picture noticeably. Use this to prioritise, never to skip a syllabus area.</li>
          <li>
            See how questions were verified on the <Link className="text-accent-text underline" href="/sources">Sources &amp; methodology</Link> page.
          </li>
        </ul>
      </section>
    </div>
  );
}
