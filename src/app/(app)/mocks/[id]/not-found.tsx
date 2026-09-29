import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

/** Intro or results page of a mock id that does not exist. */
export default function MockNotFound() {
  return (
    <>
      <PageHeader crumbs={[{ label: "Mock tests", href: "/mocks" }, { label: "Not found" }]} title="Mock test not found" />
      <EmptyState
        title="There is no mock test at this address"
        action={
          <ButtonLink href="/mocks" variant="primary" className="text-surface">
            All mock tests
          </ButtonLink>
        }
      >
        The link may be mistyped or out of date.
      </EmptyState>
    </>
  );
}
