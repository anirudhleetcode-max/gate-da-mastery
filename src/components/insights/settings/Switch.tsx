"use client";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Accessible on/off switch (role="switch") with a visible label and description; state is also shown as text. */
export function Switch({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="font-medium text-fg">
          {label}
        </label>
        {description ? (
          <p id={`${id}-d`} className="mt-0.5 text-sm text-fg-3">
            {description}
          </p>
        ) : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-d` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "inline-flex h-10 shrink-0 items-center gap-2 rounded-full pl-1 pr-3 text-sm font-medium transition-colors disabled:opacity-50",
          checked ? "bg-accent-soft text-accent-text" : "bg-surface-2 text-fg-2",
        )}
      >
        <span aria-hidden className={cn("relative inline-block h-6 w-10 rounded-full border transition-colors", checked ? "border-accent bg-accent" : "border-border-strong bg-surface-3")}>
          <span className={cn("absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-[left]", checked ? "left-[18px]" : "left-0.5")} />
        </span>
        <span aria-hidden className="w-7 text-left">{checked ? "On" : "Off"}</span>
      </button>
    </div>
  );
}
