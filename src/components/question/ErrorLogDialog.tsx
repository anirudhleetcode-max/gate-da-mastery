"use client";
import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { MISTAKE_LABELS, MISTAKE_TYPES, type MistakeType } from "@/lib/userdata/db";

export function ErrorLogDialog({
  open,
  onOpenChange,
  onSave,
  defaultConcept,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (v: { mistakeType: MistakeType | null; note: string; correctConcept: string }) => void;
  defaultConcept: string;
}) {
  const [mistakeType, setMistakeType] = useState<MistakeType | null>(null);
  const [note, setNote] = useState("");
  const [correctConcept, setCorrectConcept] = useState(defaultConcept);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Add to error log" description="Classify the mistake so the error log can show your patterns.">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ mistakeType, note, correctConcept });
          onOpenChange(false);
        }}
      >
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-fg">Mistake type</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {MISTAKE_TYPES.map((m) => (
              <label key={m} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                <input type="radio" name="mistake" value={m} checked={mistakeType === m} onChange={() => setMistakeType(m)} className="accent-[var(--accent)]" />
                {MISTAKE_LABELS[m]}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm font-medium text-fg">
          Correct concept
          <input value={correctConcept} onChange={(e) => setCorrectConcept(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm" />
        </label>
        <label className="block text-sm font-medium text-fg">
          Your note
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="What will you do differently next time?" className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
        </label>
        <div className="flex justify-end gap-2">
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" variant="primary">
            Save to error log
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
