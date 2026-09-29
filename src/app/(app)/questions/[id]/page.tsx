import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getQuestion } from "@/lib/server/repo";
import { buildPayload } from "@/lib/server/payload";
import { PageHeader } from "@/components/ui/PageHeader";
import { QuestionPageClient } from "./QuestionPageClient";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const q = getQuestion(id);
  if (!q) return { title: "Question not found" };
  const t = q.origin === "OFFICIAL_PYQ" ? `GATE DA ${q.year} Q.${q.questionNumber}` : q.origin === "MOCK_TEST" ? `Mock question ${q.id}` : `Practice question ${q.id}`;
  return { title: t, description: q.preview };
}

export default async function QuestionPage({ params }: Params) {
  const { id } = await params;
  const q = getQuestion(id);
  if (!q) notFound();
  const payload = buildPayload(q);
  const crumbs =
    q.origin === "OFFICIAL_PYQ"
      ? [{ label: "PYQs", href: "/pyqs" }, { label: payload.subjectName, href: `/pyqs/browse?subject=${q.subjectId}` }, { label: `${q.year} · Q.${q.questionNumber}` }]
      : q.origin === "MOCK_TEST"
        ? [{ label: "Mock tests", href: "/mocks" }, { label: `Mock ${Number(q.testId?.slice(5))}`, href: `/mocks/${q.testId}` }, { label: `Q.${q.questionNumber}` }]
        : [{ label: "Practice", href: "/practice" }, { label: payload.topicName }];
  return (
    <>
      <PageHeader title={<span className="sr-only">Question</span>} crumbs={crumbs} />
      <QuestionPageClient payload={payload} />
    </>
  );
}
