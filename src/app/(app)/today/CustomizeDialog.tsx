"use client";
import { Dialog } from "@/components/ui/Dialog";
import { Segmented } from "@/components/ui/Segmented";
import { Button } from "@/components/ui/Button";
import { DAILY_COUNTS, DEFAULT_DAILY_CONFIG, type DailyConfig, type DailyCount } from "@/lib/daily/config";
import { SUBJECT_COLOR } from "@/lib/labels";
import type { SubjectId } from "@/lib/content/schema";

export function CustomizeDialog({
  open,
  onOpenChange,
  config,
  onChange,
  subjects,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  config: DailyConfig;
  onChange: (c: DailyConfig) => void;
  /** DA subjects (General Aptitude has its own switch). */
  subjects: { id: string; name: string }[];
}) {
  const selected = config.subjects ?? subjects.map((s) => s.id);
  const toggle = (id: string, on: boolean) => {
    const next = on ? [...new Set([...selected, id])] : selected.filter((s) => s !== id);
    onChange({ ...config, subjects: next.length === subjects.length ? null : subjects.map((s) => s.id).filter((s) => next.includes(s)) });
  };
  const nothing = selected.length === 0 && !config.includeGA;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Customize today's set" description="Changes are saved on this device and regenerate today's set straight away.">
      <div className="space-y-5">
        <div>
          <p aria-hidden className="mb-1.5 text-sm font-medium text-fg">
            Number of questions
          </p>
          <Segmented
            label="Number of questions"
            value={String(config.count) as `${DailyCount}`}
            onChange={(v) => onChange({ ...config, count: Number(v) as DailyCount })}
            options={DAILY_COUNTS.map((n) => ({ value: String(n) as `${DailyCount}`, label: String(n) }))}
            className="max-sm:flex max-sm:w-full max-sm:[&>button]:min-h-10 max-sm:[&>button]:flex-1"
          />
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-fg">Subjects</legend>
          <div className="-ml-2 mb-1 flex gap-1 text-xs">
            <button type="button" className="min-h-8 rounded-md px-2 font-medium text-accent-text hover:bg-surface-2 hover:underline" onClick={() => onChange({ ...config, subjects: null })}>
              Select all
            </button>
            <button type="button" className="min-h-8 rounded-md px-2 font-medium text-accent-text hover:bg-surface-2 hover:underline" onClick={() => onChange({ ...config, subjects: [] })}>
              Clear
            </button>
          </div>
          <div className="grid gap-1 sm:grid-cols-2">
            {subjects.map((s) => (
              <label key={s.id} className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md px-2 text-sm text-fg-2 hover:bg-surface-2">
                <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={selected.includes(s.id)} onChange={(e) => toggle(s.id, e.target.checked)} />
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: SUBJECT_COLOR[s.id as SubjectId] }} />
                {s.name}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex min-h-10 cursor-pointer items-start gap-2.5 rounded-md border border-border px-3 py-2.5 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--accent)]" checked={config.includeGA} onChange={(e) => onChange({ ...config, includeGA: e.target.checked })} />
          <span>
            <span className="font-medium text-fg">Include General Aptitude</span>
            <span className="block text-xs text-fg-3">GA is 15 of the 100 marks in every GATE paper.</span>
          </span>
        </label>

        {nothing ? (
          <p role="alert" className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
            Choose at least one subject or include General Aptitude, otherwise there is nothing to practise.
          </p>
        ) : null}

        <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={() => onChange(DEFAULT_DAILY_CONFIG)}>
            Reset to defaults
          </Button>
          <Button variant="primary" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
