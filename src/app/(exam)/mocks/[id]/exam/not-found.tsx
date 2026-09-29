import { ButtonLink } from "@/components/ui/Button";

/** Exam mode for a mock id that does not exist (full-screen, no app chrome). */
export default function MockExamNotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-lg rounded-[var(--radius)] border border-border bg-surface p-6 text-sm text-fg-2 shadow-[var(--shadow)]">
        <h1 className="mb-2 text-lg font-semibold text-fg">Mock test not found</h1>
        <p>There is no mock test at this address. The link may be mistyped or out of date.</p>
        <div className="mt-5">
          <ButtonLink href="/mocks" variant="primary" className="text-surface">
            All mock tests
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
