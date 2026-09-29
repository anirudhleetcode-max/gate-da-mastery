import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { learnSubjects } from "@/components/learn/server";

export default function FormulaBookNotFound() {
  const subjects = learnSubjects();
  return (
    <>
      <PageHeader title="Formula book not found" crumbs={[{ label: "Formula book", href: "/formulas" }, { label: "Not found" }]} />
      <EmptyState title="There is no formula book for this subject" action={<ButtonLink href="/formulas">All formula books</ButtonLink>}>
        <p>The link may be mistyped or out of date. Choose a subject:</p>
        <ul className="mt-3 space-y-1">
          {subjects.map((s) => (
            <li key={s.id}>
              <Link href={`/formulas/${s.id}`} className="inline-flex min-h-8 items-center font-medium text-accent-text hover:underline">
                {s.name}
              </Link>
            </li>
          ))}
        </ul>
      </EmptyState>
    </>
  );
}
