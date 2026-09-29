import type { Metadata } from "next";
import Link from "next/link";
import { getMocks, getPyqs, getQuestion, getTopic } from "@/lib/server/repo";
import type { DemoQuestion } from "@/lib/demo/seed";
import { PageHeader } from "@/components/ui/PageHeader";
import { Preferences } from "@/components/insights/settings/Preferences";
import { DataManagement } from "@/components/insights/settings/DataManagement";
import { DemoMode, type DemoMockOption } from "@/components/insights/settings/DemoMode";

export const metadata: Metadata = {
  title: "Settings & data",
  description: "Study preferences, backup and restore of your local progress, reset, and the separate demo mode.",
};

export default function SettingsPage() {
  // Demo data may reference only real, servable ids: official PYQs (always servable) and questions of
  // AVAILABLE mocks (their answers are fetched from the mock key API only if the student opts in).
  const pyqs: DemoQuestion[] = getPyqs()
    .filter((q) => getQuestion(q.id) !== undefined)
    .map((q) => ({
      id: q.id,
      origin: "OFFICIAL_PYQ",
      subjectId: q.subjectId,
      topicId: q.topicId,
      topicName: getTopic(q.topicId)?.name ?? q.topicId,
      type: q.type,
      marks: q.marks,
      estimatedTimeSec: q.estimatedTimeSec,
      answer: q.answer,
      title: `GATE DA ${q.year} · Q.${q.questionNumber}`,
      questionNumber: q.questionNumber,
    }));
  const mocks: DemoMockOption[] = getMocks()
    .filter((m) => m.available)
    .sort((a, b) => a.number - b.number)
    .map((m) => ({ id: m.id, number: m.number, title: m.title, durationMinutes: m.durationMinutes, negativeMarking: m.negativeMarking, questionIds: m.questionIds }));

  return (
    <>
      <PageHeader
        title="Settings & data"
        crumbs={[{ label: "Settings & data" }]}
        description={
          <>
            Preferences, backups and demo mode. Your progress lives only in this browser; see{" "}
            <Link href="/sources" className="text-accent-text underline">
              Sources &amp; methodology
            </Link>{" "}
            for how content is verified.
          </>
        }
      />
      {/* Mobile order: preferences, your data, demo. Desktop: preferences + demo on the left, data on the right. */}
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <div className="lg:col-start-1 lg:row-start-1">
          <Preferences />
        </div>
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <DataManagement />
        </div>
        <div className="lg:col-start-1 lg:row-start-2">
          <DemoMode pyqs={pyqs} mocks={mocks} />
        </div>
      </div>
    </>
  );
}
