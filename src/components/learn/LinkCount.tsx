/** A count shown at the end of a link ("Vector Spaces 4"), read as "Vector Spaces (4)" by screen readers. */
export function LinkCount({ n, className = "tnum text-xs text-fg-3" }: { n: number; className?: string }) {
  return (
    <span className={className}>
      <span className="sr-only">(</span>
      {n}
      <span className="sr-only">)</span>
    </span>
  );
}
