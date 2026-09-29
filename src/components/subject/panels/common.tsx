"use client";
import type { ProgressModel } from "@/lib/analytics/useProgress";
import type { DataStatus } from "../hooks";
import type { SubjectPageData } from "../types";

export interface PanelProps {
  data: SubjectPageData;
  model: ProgressModel;
  status: DataStatus;
}

/** Shown instead of user-data sections while the local database loads, or when storage is blocked. */
export function DataStatusNote({ status, className, quiet = false }: { status: DataStatus; className?: string; quiet?: boolean }) {
  if (status === "ready") return null;
  if (quiet) return <p className={className ?? "text-sm text-fg-3"}>{status === "loading" ? "Loading…" : "Not available in this browser window."}</p>;
  return (
    <p role="status" className={className ?? "text-sm text-fg-3"}>
      {status === "loading" ? "Loading your progress…" : "Your progress cannot be read in this browser window because site storage is blocked (for example in some private windows)."}
    </p>
  );
}

export const topicHref = (subjectId: string, topicId: string) => `/subjects/${subjectId}/topics/${topicId}`;
