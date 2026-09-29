import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Dumbbell, ListTree } from "lucide-react";
import { getCatalog, getSubject, getSubjects } from "@/lib/server/repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { SubjectTabs } from "@/components/subject/SubjectTabs";
import { SubjectDot } from "@/components/subject/bits";
import { subjectPageData } from "@/components/subject/server";

type Params = { params: Promise<{ subjectId: string }> };

export function generateStaticParams() {
  return getSubjects().map((s) => ({ subjectId: s.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { subjectId } = await params;
  const s = getSubject(subjectId);
  if (!s) return { title: "Subject not found" };
  return { title: s.name, description: s.description };
}

export default async function SubjectPage({ params }: Params) {
  const { subjectId } = await params;
  const data = subjectPageData(subjectId);
  if (!data) notFound();
  const s = data.subject;
  const pool = data.pyqs.length + data.topics.reduce((a, t) => a + t.practiceCount, 0);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Subjects", href: "/subjects" }, { label: s.name }]}
        title={
          <span className="flex items-center gap-2.5">
            <SubjectDot id={s.id} className="h-3 w-3" />
            {s.name}
          </span>
        }
        description={
          <>
            <p>{s.description}</p>
            <p className="mt-1 text-sm text-fg-3">
              Official syllabus section: <span className="text-fg-2">{s.officialName}</span>
            </p>
          </>
        }
        actions={
          <>
            {pool ? (
              <ButtonLink href={`/practice?subject=${s.id}&count=10`} variant="primary">
                <Dumbbell aria-hidden className="h-4 w-4" /> Practice 10
              </ButtonLink>
            ) : null}
            <ButtonLink href={`/syllabus#${s.id}`}>
              <ListTree aria-hidden className="h-4 w-4" /> In the syllabus
            </ButtonLink>
          </>
        }
      />
      <SubjectTabs data={data} catalog={getCatalog()} />
    </>
  );
}
