import type { Metadata } from "next";
import { ListTree } from "lucide-react";
import { getCatalog, getPapers } from "@/lib/server/repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { SubjectGrid } from "@/components/subject/SubjectGrid";
import { subjectCards } from "@/components/subject/server";

export const metadata: Metadata = {
  title: "Subjects",
  description: "The seven GATE Data Science & AI subjects and General Aptitude: official syllabus sections, topics, previous-year questions, historical weightage and your progress.",
};

export default function SubjectsPage() {
  const subjects = subjectCards();
  const catalog = getCatalog();
  const years = [...new Set(getPapers().map((p) => p.year))].sort((a, b) => a - b);
  const yearText = years.length ? (years.length === 1 ? `${years[0]}` : `${years[0]}–${years[years.length - 1]}`) : "";

  return (
    <>
      <PageHeader
        title="Subjects"
        description={
          <>
            The seven GATE DA subjects in syllabus order, then General Aptitude. Weightage is a historical estimate from the official papers
            {yearText ? ` (${yearText})` : ""}, not a prediction; your progress comes only from answers saved on this device.
          </>
        }
        actions={
          <ButtonLink href="/syllabus">
            <ListTree aria-hidden className="h-4 w-4" /> Full syllabus
          </ButtonLink>
        }
      />
      <SubjectGrid subjects={subjects} catalog={catalog} />
    </>
  );
}
