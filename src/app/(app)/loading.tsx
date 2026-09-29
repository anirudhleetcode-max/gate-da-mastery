export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-4 py-2">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-64 animate-pulse rounded-lg bg-surface-3" />
      <div className="h-4 w-96 max-w-full animate-pulse rounded bg-surface-3" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-[var(--radius)] bg-surface-2" />
        ))}
      </div>
    </div>
  );
}
