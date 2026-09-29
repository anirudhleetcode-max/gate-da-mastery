import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { ExamTimer } from "@/components/learn/ExamTimer";

export const metadata: Metadata = {
  title: "Exam timer simulator",
  description: "Practise GATE DA pacing: a 180-minute full-paper timer with editable checkpoints, subject practice and custom runs, with a live pace check.",
};

export default function ExamTimerPage() {
  return (
    <>
      <PageHeader
        title="Exam timer simulator"
        crumbs={[{ label: "Exam strategy", href: "/strategy" }, { label: "Timer" }]}
        description="Practise pacing on paper or in another tab: the full 180-minute paper with checkpoints, a timed subject set, or your own duration. Count questions as you finish them to see whether you are ahead of or behind an even pace. Nothing is recorded or scored."
      />
      <ExamTimer />
    </>
  );
}
