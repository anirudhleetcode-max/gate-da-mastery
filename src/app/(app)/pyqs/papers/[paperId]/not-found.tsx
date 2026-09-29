import Link from "next/link";
import { getPapers } from "@/lib/server/repo";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { DA_FIRST_YEAR, sortPapersNewestFirst } from "@/components/pyq/data";
import { formatDate } from "@/lib/utils";

export default function PaperNotFound() {
  const papers = sortPapersNewestFirst(getPapers());
  return (
    <div className="py-10">
      <EmptyState title="This GATE DA paper is not in the question bank" action={<ButtonLink href="/pyqs">All PYQ papers</ButtonLink>}>
        <p>GATE DA was first held in {DA_FIRST_YEAR}. The official papers available here are:</p>
        {papers.length ? (
          <ul className="mt-2 space-y-1">
            {papers.map((p) => (
              <li key={p.id}>
                <Link href={`/pyqs/papers/${p.id}`} className="font-medium text-accent-text hover:underline">
                  GATE {p.year} · Session {p.session} · {formatDate(p.examDate)}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2">No official DA paper has been added yet.</p>
        )}
      </EmptyState>
    </div>
  );
}
