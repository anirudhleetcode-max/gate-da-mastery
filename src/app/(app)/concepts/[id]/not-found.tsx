import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ConceptNotFound() {
  return (
    <>
      <PageHeader title="Concept not found" crumbs={[{ label: "Concepts", href: "/concepts" }, { label: "Not found" }]} />
      <EmptyState
        title="This concept is not in the library"
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href="/concepts" variant="primary">
              Concept library
            </ButtonLink>
            <ButtonLink href="/search">Search</ButtonLink>
          </div>
        }
      >
        The link may be mistyped, or the note may have been renamed. The library lists every concept by subject and topic.
      </EmptyState>
    </>
  );
}
