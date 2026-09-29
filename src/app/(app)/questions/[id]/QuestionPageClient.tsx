"use client";
import Link from "next/link";
import { useMemo } from "react";
import { useStorageValue } from "@/lib/useStorage";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { QuestionView } from "@/components/question/QuestionView";
import type { QuestionPayload } from "@/lib/server/payload";
import { useMockAttempts } from "@/lib/userdata/hooks";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";

import { NAV_LIST_KEY } from "@/lib/navList";
export { NAV_LIST_KEY };

export function QuestionPageClient({ payload }: { payload: QuestionPayload }) {
  const [raw] = useStorageValue(NAV_LIST_KEY, "session");
  const list = useMemo(() => {
    try {
      return raw ? (JSON.parse(raw) as string[]) : null;
    } catch {
      return null;
    }
  }, [raw]);
  const mockAttempts = useMockAttempts(payload.testId);
  const idx = useMemo(() => (list ? list.indexOf(payload.id) : -1), [list, payload.id]);
  const prev = idx > 0 ? list![idx - 1] : null;
  const next = idx >= 0 && list && idx < list.length - 1 ? list[idx + 1] : null;

  // Mock-test questions stay hidden until that mock has been submitted (no spoilers).
  if (payload.origin === "MOCK_TEST" && !mockAttempts.some((a) => a.status === "submitted")) {
    return (
      <EmptyState title="This question belongs to a mock test you have not taken yet" action={<ButtonLink href={`/mocks/${payload.testId}`} variant="primary">Go to the mock test</ButtonLink>}>
        Mock questions unlock for review once you submit that mock, so the test stays unseen.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-6">
      <QuestionView q={payload} context={payload.origin === "OFFICIAL_PYQ" ? "pyq" : payload.origin === "MOCK_TEST" ? "mock" : "practice"} />
      {idx >= 0 ? (
        <nav aria-label="Question navigation" className="flex items-center justify-between gap-3 border-t border-border pt-4">
          {prev ? (
            <Link href={`/questions/${prev}`} className="inline-flex items-center gap-1 text-sm font-medium text-accent-text hover:underline">
              <ChevronLeft aria-hidden className="h-4 w-4" /> Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="tnum text-sm text-fg-3">
            {idx + 1} of {list!.length}
          </span>
          {next ? (
            <Link href={`/questions/${next}`} className="inline-flex items-center gap-1 text-sm font-medium text-accent-text hover:underline">
              Next <ChevronRight aria-hidden className="h-4 w-4" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
