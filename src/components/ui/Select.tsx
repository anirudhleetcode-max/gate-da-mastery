import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Select({ label, className, children, id, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const sid = id ?? `sel-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <label htmlFor={sid} className={cn("flex min-w-0 flex-col gap-1 text-xs font-medium text-fg-3", className)}>
      {label}
      <select id={sid} className="h-9 min-w-0 rounded-lg border border-border bg-surface px-2.5 text-sm text-fg" {...props}>
        {children}
      </select>
    </label>
  );
}
