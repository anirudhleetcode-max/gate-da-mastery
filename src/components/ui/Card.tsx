import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[var(--radius)] border border-border bg-surface shadow-[var(--shadow)]", className)} {...props} />;
}

export function CardHeader({ title, description, action, className, as: As = "h2" }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string; as?: "h2" | "h3" }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5", className)}>
      <div className="min-w-0">
        <As className="text-[0.95rem] font-semibold text-fg">{title}</As>
        {description ? <p className="mt-0.5 text-sm text-fg-3">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 py-4 sm:px-5", className)} {...props} />;
}
