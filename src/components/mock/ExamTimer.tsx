"use client";
import { AlarmClock, Clock } from "lucide-react";
import { formatClock, cn } from "@/lib/utils";
import { isTimeWarning, timeAlertLevel, timeAlertMessage } from "@/lib/mock/timer";

/**
 * Countdown display (hh:mm:ss). The clock itself is not a live region (it
 * would be read every second); a separate polite live region announces 30,
 * 10, 5 and 1 minute(s) remaining, once each. At 10 minutes the timer turns
 * to the warning colour and its icon changes, so the cue is not colour-only.
 */
export function ExamTimer({ remainingMs, durationMs, className }: { remainingMs: number; durationMs: number; className?: string }) {
  const warn = isTimeWarning(remainingMs);
  const Icon = warn ? AlarmClock : Clock;
  const message = timeAlertMessage(timeAlertLevel(remainingMs, durationMs));
  return (
    <div className={cn("flex items-center", className)}>
      <div
        role="timer"
        aria-label={`Time remaining ${formatClock(remainingMs)}`}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-semibold sm:text-base",
          warn ? "border-warning/50 bg-warning-soft text-warning" : "border-border bg-surface-2 text-fg",
        )}
      >
        <Icon aria-hidden className="h-4 w-4 shrink-0" />
        <span className="tnum" aria-hidden>
          {formatClock(remainingMs)}
        </span>
        {warn ? <span className="sr-only">(less than 10 minutes left)</span> : null}
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {message}
      </p>
    </div>
  );
}
