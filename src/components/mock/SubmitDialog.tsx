"use client";
import { AlertTriangle } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { PALETTE_LABEL, answeredCount, type PaletteCounts, type PaletteState } from "@/lib/mock/palette";
import { PaletteGlyph } from "./PaletteGlyph";
import { formatClock } from "@/lib/utils";

const ROWS: PaletteState[] = ["answered", "answered_marked", "not_answered", "marked", "not_visited"];

/** Confirmation before submitting, with the GATE-style status summary. */
export function SubmitDialog({
  open,
  onOpenChange,
  onConfirm,
  total,
  counts,
  sections,
  remainingMs,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: () => void;
  total: number;
  counts: PaletteCounts;
  sections?: { label: string; total: number; counts: PaletteCounts }[];
  remainingMs: number;
}) {
  const answered = answeredCount(counts);
  const unanswered = total - answered;
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Submit the test?" description={`Time remaining: ${formatClock(remainingMs)}. After submitting you cannot change any answer.`}>
      <div className="space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Question status summary</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs text-fg-3">
                <th scope="col" className="py-1.5 pr-2 font-medium">
                  Status
                </th>
                {sections && sections.length > 1 ? (
                  sections.map((s) => (
                    <th key={s.label} scope="col" className="px-2 py-1.5 text-right font-medium">
                      {s.label}
                    </th>
                  ))
                ) : null}
                <th scope="col" className="py-1.5 pl-2 text-right font-medium">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r} className="border-b border-border last:border-0">
                  <th scope="row" className="py-2 pr-2 text-left font-normal text-fg-2">
                    <span className="flex items-center gap-2">
                      <PaletteGlyph state={r} size="sm" />
                      {PALETTE_LABEL[r]}
                    </span>
                  </th>
                  {sections && sections.length > 1
                    ? sections.map((s) => (
                        <td key={s.label} className="tnum px-2 py-2 text-right text-fg">
                          {s.counts[r]}
                        </td>
                      ))
                    : null}
                  <td className="tnum py-2 pl-2 text-right font-semibold text-fg">{counts[r]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-fg-2">
          <strong className="text-fg">{answered}</strong> of {total} questions will be scored. Answered &amp; marked questions are scored; questions only marked for review are not.
        </p>
        {unanswered > 0 ? (
          <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-fg">
            <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            {unanswered} {unanswered === 1 ? "question is" : "questions are"} still unanswered.
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={() => onOpenChange(false)}>Keep working</Button>
          <Button variant="primary" onClick={onConfirm}>
            Submit test
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
