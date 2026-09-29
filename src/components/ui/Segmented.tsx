"use client";
import { cn } from "@/lib/utils";

/** Accessible segmented control (radio group semantics). */
export function Segmented<T extends string>({ value, onChange, options, label, size = "md", className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string; size?: "sm" | "md"; className?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-lg border border-border bg-surface-2 p-0.5", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const i = options.findIndex((x) => x.value === value);
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                onChange(options[(i + 1) % options.length].value);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                onChange(options[(i - 1 + options.length) % options.length].value);
              }
            }}
            tabIndex={active ? 0 : -1}
            className={cn(
              "rounded-md font-medium transition-colors",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
              active ? "bg-surface text-fg shadow-sm" : "text-fg-3 hover:text-fg",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
