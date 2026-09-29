"use client";
import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="py-10">
      <EmptyState
        title="Something went wrong on this page"
        action={
          <div className="flex gap-2">
            <Button variant="primary" onClick={reset}>
              Try again
            </Button>
            <ButtonLink href="/">Dashboard</ButtonLink>
          </div>
        }
      >
        Your progress is stored locally in your browser and is not affected. {error.digest ? `Reference: ${error.digest}` : null}
      </EmptyState>
    </div>
  );
}
