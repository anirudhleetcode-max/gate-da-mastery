import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import type { VerificationStatus } from "@/lib/content/schema";
import { getCatalog } from "@/lib/server/repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { VerificationBadge } from "@/components/question/badges";
import { SourceLinks } from "@/components/subject/bits";
import { SyllabusTree } from "@/components/subject/SyllabusTree";
import { syllabusData } from "@/components/subject/server";
import type { SourceRef } from "@/components/subject/types";

export const metadata: Metadata = {
  title: "GATE DA Syllabus",
  description: "The official GATE Data Science & AI syllabus, verbatim, organised subject → topic → syllabus phrase, with PYQ and practice counts and your own progress on each.",
};

const RANK: Record<VerificationStatus, number> = { NEEDS_REVIEW: 0, PARTIALLY_VERIFIED: 1, VERIFIED: 2 };

export default function SyllabusPage() {
  const data = syllabusData();
  const sources = [...new Map(data.subjects.flatMap((s) => s.sources).map((s) => [s.id, s] as const)).values()] as SourceRef[];
  const weakest = data.subjects.reduce<VerificationStatus>((w, s) => (RANK[s.syllabusStatus] < RANK[w] ? s.syllabusStatus : w), "VERIFIED");
  const topics = data.subjects.reduce((a, s) => a + s.topics.length, 0);
  const phrases = data.subtopicIds.length;

  return (
    <>
      <PageHeader
        title="GATE DA Syllabus"
        description={
          <>
            The official GATE {data.examYear} Data Science &amp; Artificial Intelligence (DA) syllabus, reproduced verbatim for each subject, with General Aptitude last. Each subject&apos;s phrases are grouped
            into {topics} platform topics ({phrases} syllabus phrases in all); open a topic to study it.
          </>
        }
      />

      <Card className="mb-6">
        <CardBody className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <ShieldCheck aria-hidden className="h-4 w-4 text-success" />
            <span className="font-medium text-fg">Verification:</span>
            <VerificationBadge status={weakest} />
            <span className="text-fg-3">Official text from</span>
            <SourceLinks sources={sources} className="text-sm" />
            <Link href="/sources" className="font-medium text-accent-text hover:underline">
              Sources &amp; methodology
            </Link>
          </div>
          {data.notes.length ? (
            <div>
              <h2 className="text-sm font-semibold text-fg">Notes on this syllabus</h2>
              <ul className="mt-1.5 list-disc space-y-1.5 pl-5 text-fg-2">
                {data.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <SyllabusTree data={data} catalog={getCatalog()} />
    </>
  );
}
