"use client";
/** Form fields that save to the local database as the student edits (select: on change; text: on blur or Enter). */
import { useState, type KeyboardEvent } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const control = "w-full min-w-0 rounded-lg border border-border bg-surface text-sm text-fg disabled:bg-surface-2";

export type SaveState = "idle" | "saved" | "error";

export function SavedNote({ state }: { state: SaveState }) {
  return (
    <span role="status" aria-live="polite" className={cn("inline-flex items-center gap-1 text-xs font-normal", state === "error" ? "text-danger" : "text-success")}>
      {state === "saved" ? (
        <>
          <Check aria-hidden className="h-3.5 w-3.5" />
          Saved
        </>
      ) : state === "error" ? (
        <>
          <X aria-hidden className="h-3.5 w-3.5" />
          Not saved, try again
        </>
      ) : null}
    </span>
  );
}

/** Text input or textarea that saves when it loses focus (or on Enter for single-line inputs). */
export function BlurField({
  id,
  label,
  value,
  onSave,
  multiline = false,
  placeholder,
  list,
  disabled,
  srContext,
}: {
  id: string;
  label: string;
  value: string;
  onSave: (v: string) => Promise<void>;
  multiline?: boolean;
  placeholder?: string;
  list?: string;
  disabled?: boolean;
  /** Extra accessible context for repeated labels (e.g. the question title). */
  srContext?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState<SaveState>("idle");
  const commit = async () => {
    if (draft === null) return;
    if (draft !== value) {
      try {
        await onSave(draft);
        setSaved("saved");
      } catch {
        // Keep the draft so nothing typed is lost.
        setSaved("error");
        return;
      }
    }
    setDraft(null);
  };
  const common = {
    id,
    value: draft ?? value,
    placeholder,
    disabled,
    onChange: (e: { target: { value: string } }) => {
      setDraft(e.target.value);
      setSaved("idle");
    },
    onBlur: () => void commit(),
  };
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-fg-2">
          {label}
          {srContext ? <span className="sr-only"> for {srContext}</span> : null}
        </label>
        <SavedNote state={saved} />
      </div>
      {multiline ? (
        <textarea {...common} rows={2} className={cn(control, "min-h-10 px-2.5 py-2 leading-5")} />
      ) : (
        <input
          {...common}
          type="text"
          list={list}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commit();
            }
          }}
          className={cn(control, "h-10 px-2.5")}
        />
      )}
    </div>
  );
}

export function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  onSave,
  disabled,
  srOnlyLabel,
  srContext,
}: {
  id: string;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onSave: (v: T) => Promise<void>;
  disabled?: boolean;
  srOnlyLabel?: boolean;
  srContext?: string;
}) {
  const [saved, setSaved] = useState<SaveState>("idle");
  return (
    <div className="min-w-0">
      <div className={cn("mb-1 flex items-center justify-between gap-2", srOnlyLabel && "sr-only")}>
        <label htmlFor={id} className="text-xs font-medium text-fg-2">
          {label}
          {srContext ? <span className="sr-only"> for {srContext}</span> : null}
        </label>
        <SavedNote state={saved} />
      </div>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={async (e) => {
          setSaved("idle");
          try {
            await onSave(e.target.value as T);
            setSaved("saved");
          } catch {
            setSaved("error");
          }
        }}
        className={cn(control, "h-10 px-2")}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
