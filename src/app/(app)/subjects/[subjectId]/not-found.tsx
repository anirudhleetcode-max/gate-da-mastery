import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { orderedSubjects } from "@/components/subject/server";

export default function SubjectNotFound() {
  const subjects = orderedSubjects();
  return (
    <div className="py-10">
      <EmptyState title="This subject or topic is not part of the GATE DA syllabus here" action={<ButtonLink href="/syllabus">Full syllabus</ButtonLink>}>
        <p>The link may be mistyped or out of date. The subjects are:</p>
        <ul className="mt-2 space-y-1">
          {subjects.map((s) => (
            <li key={s.id}>
              <Link href={`/subjects/${s.id}`} className="font-medium text-accent-text hover:underline">
                {s.name}
              </Link>
            </li>
          ))}
        </ul>
      </EmptyState>
    </div>
  );
}
