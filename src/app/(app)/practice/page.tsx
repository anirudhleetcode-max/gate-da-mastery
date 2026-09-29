import type { Metadata } from "next";
import { getAllMetas, getCatalog, getMocks } from "@/lib/server/repo";
import { toPoolQuestion } from "@/lib/practice/pool";
import { parsePracticeQuery } from "@/lib/practice/select";
import { PageHeader } from "@/components/ui/PageHeader";
import { PracticeClient, type PracticeTaxonomy } from "./PracticeClient";

export const metadata: Metadata = {
  title: "Practice now",
  description: "Build a practice set of GATE DA questions by subject, topic, difficulty, source and your own history, timed or untimed.",
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PracticePage({ searchParams }: Props) {
  const sp = await searchParams;
  const catalog = getCatalog();
  // Selection metadata for every question. Mock-test questions are included so that
  // questions of mocks the student has SUBMITTED can be practised; the client drops the rest.
  const pool = getAllMetas().map(toPoolQuestion);
  const taxonomy: PracticeTaxonomy = catalog.subjects.map((s) => ({
    id: s.id,
    name: s.name,
    topics: catalog.topics.filter((t) => t.subjectId === s.id).map((t) => ({ id: t.id, name: t.name })),
  }));
  const initial = parsePracticeQuery(sp, {
    subjectIds: new Set(catalog.subjects.map((s) => s.id)),
    topicSubject: new Map(catalog.topics.map((t) => [t.id, t.subjectId])),
  });
  const mockCount = getMocks().length;

  return (
    <>
      <PageHeader
        title="Practice now"
        description="Build a set of questions to practise right now: choose how many, which subject or topic, the difficulty and where the questions come from, then work through them one by one with full solutions."
      />
      {/* Keyed by the incoming query so a link with other parameters starts a fresh form. */}
      <PracticeClient key={JSON.stringify(initial)} pool={pool} taxonomy={taxonomy} initialFilters={initial.filters} initialIds={initial.ids} mockCount={mockCount} />
    </>
  );
}
