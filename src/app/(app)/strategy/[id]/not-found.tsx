import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export default function StrategyNotFound() {
  return (
    <>
      <PageHeader title="Article not found" crumbs={[{ label: "Exam strategy", href: "/strategy" }, { label: "Not found" }]} />
      <EmptyState
        title="This strategy article does not exist"
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href="/strategy" variant="primary">
              Exam strategy
            </ButtonLink>
            <ButtonLink href="/strategy/timer">Exam timer</ButtonLink>
          </div>
        }
      >
        The link may be mistyped, or the article may have been renamed. The strategy page lists every article by section.
      </EmptyState>
    </>
  );
}
