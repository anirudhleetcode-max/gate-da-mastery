"use client";
import type { ReactNode } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { PrintButton } from "./PrintButton";
import { usePersistentValue } from "./persist";

const VIEW_KEY = "gate-da-formula-view";

/**
 * Wraps a subject's formula cards with a view switch: full cards, or the
 * formulas alone for quick revision (and a compact printout). The choice is
 * remembered on this device. Cards hide their details through the
 * `group/book` data attribute, so the server-rendered cards stay as they are.
 */
export function FormulaBookView({ children, count }: { children: ReactNode; count: number }) {
  const [raw, set] = usePersistentValue("local", VIEW_KEY);
  const compact = raw === "compact";
  return (
    <div data-compact={compact ? "true" : "false"} className="group/book">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-border bg-surface px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span aria-hidden className="text-sm text-fg-3">
            View
          </span>
          <Segmented
            label="Formula book view"
            value={compact ? "compact" : "full"}
            onChange={(v) => set(v === "compact" ? "compact" : null)}
            options={[
              { value: "full", label: "Full cards" },
              { value: "compact", label: "Formulas only" },
            ]}
          />
        </div>
        <div className="flex items-center gap-3">
          <p className="hidden text-xs text-fg-3 md:block">
            {compact ? `Showing ${count} formulas without explanations.` : "Prints the view you choose."}
          </p>
          <PrintButton />
        </div>
      </div>
      {children}
    </div>
  );
}
