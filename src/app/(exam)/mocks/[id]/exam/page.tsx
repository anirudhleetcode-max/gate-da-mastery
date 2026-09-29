import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMock, getPattern } from "@/lib/server/repo";
import { ExamRunner } from "@/components/mock/ExamRunner";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const test = getMock(id);
  return { title: test ? `Mock ${test.number}: exam` : "Mock test not found", robots: { index: false } };
}

/** Full-screen exam mode. The paper (without answers) is fetched by the client. */
export default async function MockExamPage({ params }: Params) {
  const { id } = await params;
  const test = getMock(id);
  if (!test) notFound();
  return <ExamRunner testId={test.id} testTitle={test.title} pattern={getPattern()} />;
}
