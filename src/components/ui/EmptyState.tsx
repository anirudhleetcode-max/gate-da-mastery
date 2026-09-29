import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({ title, children, action, className }: { title: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[var(--radius)] border border-dashed border-border-strong bg-surface px-5 py-8 text-center", className)}>
      <p className="font-medium text-fg">{title}</p>
      {children ? <div className="mx-auto mt-1 max-w-prose text-sm text-fg-3">{children}</div> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
