import type { Metadata } from "next";
import { getRoadmap } from "@/lib/server/repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { RoadmapView } from "@/components/learn/RoadmapView";
import type { RoadmapStageView } from "@/components/learn/types";

export const metadata: Metadata = {
  title: "GATE DA roadmap",
  description: "A staged GATE DA study roadmap: each stage has a goal, what to do and the exit criteria to meet before moving on. Track your progress on this device.",
};

export default function RoadmapPage() {
  const stages: RoadmapStageView[] = [...getRoadmap()]
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ id: s.id, order: s.order, title: s.title, goal: s.goal, activities: s.activities, exitCriteria: s.exitCriteria, links: s.links }));

  return (
    <>
      <PageHeader
        title="GATE DA roadmap"
        crumbs={[{ label: "Learn" }, { label: "Roadmap" }]}
        description="A staged path through GATE DA preparation. Each stage has a goal, what to do and the exit criteria to meet before moving on. Mark a stage complete when you meet them; progress is saved on this device."
      />
      {stages.length ? (
        <RoadmapView stages={stages} />
      ) : (
        <EmptyState
          title="The study roadmap has not been added yet"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href="/syllabus" variant="primary">
                Official syllabus
              </ButtonLink>
              <ButtonLink href="/subjects">Subjects</ButtonLink>
              <ButtonLink href="/today">Today&apos;s plan</ButtonLink>
            </div>
          }
        >
          The staged roadmap appears here once it is in the content library. Until then, work through the syllabus subject by subject and use the daily plan.
        </EmptyState>
      )}
    </>
  );
}
