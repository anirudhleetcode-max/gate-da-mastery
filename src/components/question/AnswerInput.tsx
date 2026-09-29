"use client";
import { Check, X } from "lucide-react";
import type { Answer, OptionLabel, QuestionType } from "@/lib/content/schema";
import type { UserResponse } from "@/lib/scoring/score";
import { RichHtml } from "@/components/ui/RichHtml";
import { cn } from "@/lib/utils";

interface Props {
  questionId: string;
  type: QuestionType;
  options: { label: OptionLabel; html: string }[];
  value: UserResponse | null;
  onChange: (r: UserResponse | null) => void;
  /** When set, the input is locked and options are marked correct/incorrect. */
  reveal?: Answer | null;
  disabled?: boolean;
}

export function AnswerInput({ questionId, type, options, value, onChange, reveal, disabled }: Props) {
  const locked = disabled || Boolean(reveal);
  if (type === "NAT") {
    const v = value?.kind === "NAT" ? value.value : "";
    const inputId = `nat-${questionId}`;
    return (
      <div className="flex flex-wrap items-end gap-3">
        <label htmlFor={inputId} className="flex flex-col gap-1 text-sm font-medium text-fg-2">
          Your numerical answer
          <input
            id={inputId}
            inputMode="decimal"
            autoComplete="off"
            value={v}
            disabled={locked}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9.+-]/g, "");
              onChange(raw ? { kind: "NAT", value: raw } : null);
            }}
            className="tnum h-11 w-48 rounded-lg border border-border-strong bg-surface px-3 text-base text-fg disabled:bg-surface-2"
            placeholder="e.g. 0.25"
          />
        </label>
        {reveal && reveal.kind === "NAT" ? (
          <p className="pb-2 text-sm text-fg-2">
            Accepted: <span className="tnum font-semibold text-fg">{reveal.min === reveal.max ? reveal.min : `${reveal.min} to ${reveal.max}`}</span>
          </p>
        ) : null}
      </div>
    );
  }

  const multi = type === "MSQ";
  const selected = new Set<OptionLabel>(value?.kind === "MCQ" ? [value.choice] : value?.kind === "MSQ" ? value.choices : []);
  const correct = new Set<OptionLabel>(reveal?.kind === "MCQ" ? [reveal.correct] : reveal?.kind === "MSQ" ? reveal.correct : []);
  const toggle = (l: OptionLabel) => {
    if (locked) return;
    if (!multi) return onChange({ kind: "MCQ", choice: l });
    const next = new Set(selected);
    if (next.has(l)) next.delete(l);
    else next.add(l);
    const choices = [...next].sort() as OptionLabel[];
    onChange(choices.length ? { kind: "MSQ", choices } : null);
  };
  const groupName = `q-${questionId}`;
  return (
    <fieldset className="space-y-2" disabled={locked}>
      <legend className="sr-only">{multi ? "Select one or more options" : "Select one option"}</legend>
      {options.map((o) => {
        const isSel = selected.has(o.label);
        const isCorrect = correct.has(o.label);
        const showMark = Boolean(reveal) && reveal!.kind !== "MTA";
        return (
          <label
            key={o.label}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors",
              locked ? "cursor-default" : "hover:border-border-strong hover:bg-surface-2",
              !showMark && isSel && "border-accent bg-accent-soft",
              !showMark && !isSel && "border-border",
              showMark && isCorrect && "border-success bg-success-soft",
              showMark && !isCorrect && isSel && "border-danger bg-danger-soft",
              showMark && !isCorrect && !isSel && "border-border opacity-80",
            )}
          >
            <input
              type={multi ? "checkbox" : "radio"}
              name={groupName}
              value={o.label}
              checked={isSel}
              onChange={() => toggle(o.label)}
              className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
            />
            <span className="w-6 shrink-0 font-semibold text-fg-2">({o.label})</span>
            <RichHtml html={o.html} className="min-w-0 flex-1" />
            {showMark && isCorrect ? <Check aria-label="Correct option" className="mt-0.5 h-5 w-5 shrink-0 text-success" /> : null}
            {showMark && !isCorrect && isSel ? <X aria-label="Incorrect choice" className="mt-0.5 h-5 w-5 shrink-0 text-danger" /> : null}
          </label>
        );
      })}
    </fieldset>
  );
}
