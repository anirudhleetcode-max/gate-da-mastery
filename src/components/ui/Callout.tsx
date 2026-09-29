import type { ReactNode } from "react";
import { AlertTriangle, Info, CheckCircle2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "info" | "warning" | "success" | "danger";
const styles: Record<Tone, string> = {
  info: "border-info/30 bg-info-soft text-fg",
  warning: "border-warning/30 bg-warning-soft text-fg",
  success: "border-success/30 bg-success-soft text-fg",
  danger: "border-danger/30 bg-danger-soft text-fg",
};
const icons = { info: Info, warning: AlertTriangle, success: CheckCircle2, danger: ShieldAlert };
const iconColor = { info: "text-info", warning: "text-warning", success: "text-success", danger: "text-danger" };

export function Callout({ tone = "info", title, children, className }: { tone?: Tone; title?: ReactNode; children?: ReactNode; className?: string }) {
  const Icon = icons[tone];
  return (
    <div role={tone === "danger" || tone === "warning" ? "note" : undefined} className={cn("flex gap-3 rounded-[var(--radius)] border px-4 py-3 text-sm", styles[tone], className)}>
      <Icon aria-hidden className={cn("mt-0.5 h-4 w-4 shrink-0", iconColor[tone])} />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn("text-fg-2", title && "mt-0.5")}>{children}</div> : null}
      </div>
    </div>
  );
}
