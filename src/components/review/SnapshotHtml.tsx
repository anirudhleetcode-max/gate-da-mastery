"use client";
/**
 * Offline copy of a bookmarked question. The snapshot comes back from local
 * storage (or an imported backup), so it is untrusted and passes through the
 * allowlist sanitiser in src/lib/userdata/sanitize.ts before RichHtml
 * hydrates its math.
 */
import { useMemo } from "react";
import { RichHtml } from "@/components/ui/RichHtml";
import { sanitizeSnapshotHtml } from "@/lib/userdata/sanitize";

export { sanitizeSnapshotHtml };

export function SnapshotHtml({ html, className }: { html: string; className?: string }) {
  const safe = useMemo(() => sanitizeSnapshotHtml(html), [html]);
  if (!safe.trim()) return <p className="text-sm text-fg-3">The saved copy is empty.</p>;
  return <RichHtml html={safe} className={className} />;
}
