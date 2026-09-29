import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "success" | "danger" | "warning" | "info" | "outline";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-fg-2 border-border",
  accent: "bg-accent-soft text-accent-text border-transparent",
  success: "bg-success-soft text-success border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
  warning: "bg-warning-soft text-warning border-transparent",
  info: "bg-info-soft text-info border-transparent",
  outline: "bg-transparent text-fg-2 border-border",
};

export function Badge({ tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[0.72rem] font-medium leading-4", tones[tone], className)}
      {...props}
    />
  );
}
