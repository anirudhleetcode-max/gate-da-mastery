import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function NotFound() {
  return (
    <div className="py-10">
      <EmptyState
        title="Page not found"
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href="/" variant="primary">
              Dashboard
            </ButtonLink>
            <ButtonLink href="/pyqs">PYQs</ButtonLink>
            <ButtonLink href="/search">Search</ButtonLink>
          </div>
        }
      >
        The page or question you are looking for does not exist. It may have been renamed.
      </EmptyState>
    </div>
  );
}
