"use client";
/**
 * Searchable select (ARIA combobox + listbox) for adding a concept or a
 * formula to the revision queue.
 */
import { useId, useMemo, useRef, useState } from "react";
import { Check, Plus, Search } from "lucide-react";
import type { SubjectId } from "@/lib/content/schema";
import { SUBJECT_SHORT } from "@/lib/labels";
import { cn } from "@/lib/utils";

export interface PickerOption {
  kind: "concept" | "formula";
  id: string;
  title: string;
  subjectId: SubjectId;
  topicId: string;
  topicName: string;
}

const MAX_SHOWN = 40;

export function ContentPicker({
  options,
  inQueue,
  onPick,
  disabled,
}: {
  options: PickerOption[];
  /** Keys (`kind:id`) already in the revision queue. */
  inQueue: ReadonlySet<string>;
  onPick: (o: PickerOption) => Promise<void> | void;
  disabled?: boolean;
}) {
  const uid = useId();
  const inputId = `${uid}-input`;
  const listId = `${uid}-list`;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const hay = (o: PickerOption) => `${o.title} ${o.topicName} ${SUBJECT_SHORT[o.subjectId]} ${o.kind}`.toLowerCase();
    return options.filter((o) => terms.every((t) => hay(o).includes(t)));
  }, [options, query]);
  const shown = matches.slice(0, MAX_SHOWN);
  const activeIndex = Math.min(active, Math.max(0, shown.length - 1));
  const optId = (i: number) => `${uid}-opt-${i}`;

  async function choose(o: PickerOption | undefined) {
    if (!o) return;
    const key = `${o.kind}:${o.id}`;
    if (inQueue.has(key)) {
      setMessage(`“${o.title}” is already in your revision queue.`);
      return;
    }
    await onPick(o);
    setMessage(`Added “${o.title}” to your revision queue. It is due today.`);
    setQuery("");
    setActive(0);
    setOpen(false);
    inputRef.current?.focus();
  }

  const expanded = open && !disabled;

  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-medium text-fg">
        Find a concept or formula
      </label>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3" />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-activedescendant={expanded && shown.length ? optId(activeIndex) : undefined}
          aria-describedby={`${uid}-hint`}
          disabled={disabled}
          value={query}
          placeholder="Type a name, topic or subject"
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
            setMessage("");
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (!open) setOpen(true);
              else setActive((activeIndex + 1) % Math.max(1, shown.length));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setOpen(true);
              setActive((activeIndex - 1 + shown.length) % Math.max(1, shown.length));
            } else if (e.key === "Home" && open) {
              setActive(0);
            } else if (e.key === "End" && open) {
              setActive(Math.max(0, shown.length - 1));
            } else if (e.key === "Enter") {
              if (expanded && shown.length) {
                e.preventDefault();
                void choose(shown[activeIndex]);
              }
            } else if (e.key === "Escape") {
              if (open) {
                e.preventDefault();
                setOpen(false);
              } else setQuery("");
            }
          }}
          className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-fg placeholder:text-fg-3 disabled:bg-surface-2"
        />
        <ul
          id={listId}
          role="listbox"
          aria-label="Concepts and formulas"
          hidden={!expanded}
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          {shown.length ? (
            shown.map((o, i) => {
              const added = inQueue.has(`${o.kind}:${o.id}`);
              return (
                <li
                  key={`${o.kind}:${o.id}`}
                  id={optId(i)}
                  role="option"
                  aria-selected={i === activeIndex}
                  aria-disabled={added || undefined}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => void choose(o)}
                  className={cn("flex cursor-pointer items-start gap-2 px-3 py-2 text-sm", i === activeIndex && "bg-surface-2", added && "cursor-default")}
                >
                  <span className="mt-0.5 w-16 shrink-0 text-xs font-medium uppercase tracking-wide text-fg-3">{o.kind === "concept" ? "Concept" : "Formula"}</span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate", added ? "text-fg-3" : "text-fg")}>{o.title}</span>
                    <span className="block truncate text-xs text-fg-3">
                      {SUBJECT_SHORT[o.subjectId]} · {o.topicName}
                    </span>
                  </span>
                  {added ? (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-fg-3">
                      <Check aria-hidden className="h-3.5 w-3.5" /> In revision
                    </span>
                  ) : (
                    <Plus aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-fg-3" />
                  )}
                </li>
              );
            })
          ) : (
            <li role="option" aria-selected={false} aria-disabled className="px-3 py-2 text-sm text-fg-3">
              {options.length ? "Nothing matches. Try a shorter word." : "Nothing to add yet."}
            </li>
          )}
          {matches.length > shown.length ? <li role="presentation" className="px-3 py-1.5 text-xs text-fg-3">Showing {MAX_SHOWN} of {matches.length}. Type more to narrow the list.</li> : null}
        </ul>
      </div>
      <p id={`${uid}-hint`} className="text-xs text-fg-3">
        Use the arrow keys to move through the list and Enter to add. Added items are due today.
      </p>
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-fg-2">
        {message}
      </p>
    </div>
  );
}
