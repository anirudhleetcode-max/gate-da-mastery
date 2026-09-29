import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { orderedSubjects } from "@/components/subject/server";

export default function SubjectNotFound() {
  const subjects = orderedSubjects();
  return (
    <>
      <PageHeader title="Subject or topic not found" crumbs={[{ label: "Subjects", href: "/subjects" }, { label: "Not found" }]} />
      <EmptyState title="This subject or topic is not part of the GATE DA syllabus here" action={<ButtonLink href="/syllabus">Full syllabus</ButtonLink>}>
        <p>The link may be mistyped or out of date. Choose a subject:</p>
        <ul className="mt-3 space-y-1">
          {subjects.map((s) => (
            <li key={s.id}>
              <Link href={`/subjects/${s.id}`} className="inline-flex min-h-8 items-center font-medium text-accent-text hover:underline">
                {s.name}
              </Link>
            </li>
          ))}
        </ul>
      </EmptyState>
    </>
  );
}
