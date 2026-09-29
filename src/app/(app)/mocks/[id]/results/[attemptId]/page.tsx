import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMock } from "@/lib/server/repo";
import { ResultsView } from "@/components/mock/ResultsView";

type Params = { params: Promise<{ id: string; attemptId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const test = getMock(id);
  return { title: test ? `Mock ${test.number} results` : "Mock test not found", robots: { index: false } };
}

/** Results of one attempt. The attempt lives in the browser (IndexedDB), so the page is a client view. */
export default async function MockResultsPage({ params }: Params) {
  const { id, attemptId } = await params;
  const test = getMock(id);
  if (!test) notFound();
  return <ResultsView test={{ id: test.id, number: test.number, title: test.title, durationMinutes: test.durationMinutes }} attemptId={decodeURIComponent(attemptId)} />;
}
