"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Circle, CircleCheck, CircleDot, ExternalLink, ListChecks } from "lucide-react";
import { useDbQuery, useRoadmap, useUserData } from "@/lib/userdata/hooks";
import { setRoadmapStage } from "@/lib/userdata/ops";
import { localDay } from "@/lib/userdata/db";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/Progress";
import { cn, formatDate, pct } from "@/lib/utils";
import type { RoadmapStageView } from "./types";

type Status = "loading" | "unavailable" | "ready";

function completedOn(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : formatDate(localDay(d));
}

export function RoadmapView({ stages }: { stages: RoadmapStageView[] }) {
  const { db, ready, available } = useUserData();
  const rows = useRoadmap();
  // -1 until the roadmap table has been read, so "loading" is never shown as "0 complete".
  const count = useDbQuery((d) => d.roadmap.count(), [], -1);
  const status: Status = !ready ? "loading" : !available ? "unavailable" : count < 0 ? "loading" : "ready";
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const byId = new Map(rows.map((r) => [r.stageId, r]));
  const isDone = (id: string) => byId.get(id)?.completed === true;
  const completed = stages.filter((s) => isDone(s.id)).length;
  const current = status === "ready" ? (stages.find((s) => !isDone(s.id)) ?? null) : null;
  const ratio = stages.length ? completed / stages.length : 0;

  async function toggle(s: RoadmapStageView, n: number) {
    if (!db || busy) return;
    const next = !isDone(s.id);
    setBusy(s.id);
    try {
      await setRoadmapStage(db, s.id, next);
      setMessage(next ? `Stage ${n}, ${s.title}, marked complete.` : `Stage ${n}, ${s.title}, marked not complete.`);
    } catch {
      setMessage("Could not save. Your browser may be blocking local storage.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="roadmap-progress-h" className="rounded-[var(--radius)] border border-border bg-surface shadow-[var(--shadow)]">
        <div className="grid gap-5 px-4 py-4 sm:px-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="min-w-0">
            <h2 id="roadmap-progress-h" className="text-[0.95rem] font-semibold text-fg">
              Your progress
            </h2>
            {status === "ready" ? (
              <>
                <p className="mt-2 text-sm text-fg-2">
                  <span className="tnum text-2xl font-semibold text-fg">{completed}</span> of <span className="tnum">{stages.length}</span> stages complete
                </p>
                <ProgressBar value={completed} max={stages.length} label="Roadmap stages complete" tone={completed === stages.length ? "success" : "accent"} showValue className="mt-2" />
                <p className="mt-3 text-sm text-fg-2">
                  {current ? (
                    <>
                      Current stage:{" "}
                      <a href={`#stage-${current.id}`} className="font-medium text-accent-text hover:underline">
                        {stages.indexOf(current) + 1}. {current.title}
                      </a>
                    </>
                  ) : (
                    "Every stage is complete. Keep taking full mocks and revising your error log until exam day."
                  )}
                </p>
              </>
            ) : status === "unavailable" ? (
              <p className="mt-2 text-sm text-fg-2">Your browser is blocking local storage, so stage progress cannot be saved in this window. The roadmap itself is below.</p>
            ) : (
              <p className="mt-2 text-sm text-fg-3">Loading your progress…</p>
            )}
            <p className="mt-2 text-xs text-fg-3">Saved on this device only. {status === "ready" && completed ? `${pct(ratio, 0)} of the roadmap done.` : ""}</p>
          </div>
          <nav aria-label="Roadmap stages" className="min-w-0">
            <ol className="grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
              {stages.map((s, i) => {
                const done = status === "ready" && isDone(s.id);
                const isCurrent = current?.id === s.id;
                return (
                  <li key={s.id}>
                    <a
                      href={`#stage-${s.id}`}
                      className={cn(
                        "flex min-h-9 items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-surface-2",
                        isCurrent ? "bg-accent-soft font-medium text-accent-text" : "text-fg-2",
                      )}
                    >
                      {done ? (
                        <CircleCheck aria-hidden className="h-4 w-4 shrink-0 text-success" />
                      ) : isCurrent ? (
                        <CircleDot aria-hidden className="h-4 w-4 shrink-0" />
                      ) : (
                        <Circle aria-hidden className="h-4 w-4 shrink-0 text-fg-3" />
                      )}
                      <span className="tnum w-5 shrink-0 text-xs text-fg-3">{i + 1}.</span>
                      <span className="min-w-0">{s.title}</span>
                      <span className="sr-only">{done ? " (complete)" : isCurrent ? " (current stage)" : ""}</span>
                    </a>
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>
      </section>

      <p role="status" className="sr-only">
        {message}
      </p>

      <ol className="space-y-4">
        {stages.map((s, i) => {
          const n = i + 1;
          const row = byId.get(s.id);
          const done = status === "ready" && row?.completed === true;
          const isCurrent = current?.id === s.id;
          const date = done ? completedOn(row?.completedAt) : null;
          const headingId = `stage-${s.id}-h`;
          return (
            <li key={s.id} id={`stage-${s.id}`} className="scroll-mt-20">
              <article
                aria-labelledby={headingId}
                className={cn("rounded-[var(--radius)] border bg-surface shadow-[var(--shadow)]", isCurrent ? "border-accent ring-1 ring-accent" : "border-border")}
              >
                <div className={cn("flex flex-wrap items-start gap-3 border-b border-border px-4 py-3 sm:px-5", done && "bg-success-soft/40")}>
                  <span
                    aria-hidden
                    className={cn(
                      "tnum grid h-8 w-8 shrink-0 place-items-center rounded-full border text-sm font-semibold",
                      done ? "border-success bg-success text-white dark:text-[#0e1117]" : isCurrent ? "border-accent bg-accent text-white dark:text-[#0e1117]" : "border-border-strong text-fg-2",
                    )}
                  >
                    {done ? <CircleCheck className="h-4 w-4" /> : n}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-fg-3">Stage {n}</p>
                    <h2 id={headingId} className="text-base font-semibold text-fg">
                      {s.title}
                    </h2>
                  </div>
                  <div className="shrink-0">
                    {done ? (
                      <Badge tone="success">
                        <CircleCheck aria-hidden className="h-3 w-3" /> Completed{date ? ` · ${date}` : ""}
                      </Badge>
                    ) : isCurrent ? (
                      <Badge tone="accent">
                        <CircleDot aria-hidden className="h-3 w-3" /> Current stage
                      </Badge>
                    ) : status === "ready" ? (
                      <Badge tone="outline">Not started</Badge>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-4 px-4 py-4 sm:px-5">
                  <p className="text-[0.95rem] text-fg">
                    <span className="font-semibold">Goal: </span>
                    {s.goal}
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="min-w-0">
                      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg-3">What to do</h3>
                      <ul className="list-disc space-y-1 pl-5 text-sm text-fg-2 marker:text-fg-3">
                        {s.activities.map((a, j) => (
                          <li key={j}>{a}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="min-w-0">
                      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg-3">Move on when</h3>
                      <ul className="space-y-1 text-sm text-fg-2">
                        {s.exitCriteria.map((c, j) => (
                          <li key={j} className="flex gap-2">
                            <ListChecks aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-fg-3" />
                            <span className="min-w-0">{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {s.links.length ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-fg-3">Go to</span>
                      {s.links.map((l) =>
                        l.href.startsWith("/") ? (
                          <Link key={l.href + l.label} href={l.href} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border px-2.5 text-sm font-medium text-accent-text hover:bg-surface-2 sm:min-h-8">
                            {l.label} <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                          </Link>
                        ) : (
                          <a
                            key={l.href + l.label}
                            href={l.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-border px-2.5 text-sm font-medium text-accent-text hover:bg-surface-2 sm:min-h-8"
                          >
                            {l.label}
                            <span className="sr-only"> (opens in a new tab)</span>
                            <ExternalLink aria-hidden className="h-3.5 w-3.5" />
                          </a>
                        ),
                      )}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 sm:px-5">
                  <p className="text-xs text-fg-3">{done ? (date ? `You marked this stage complete on ${date}.` : "You marked this stage complete.") : "Mark it complete when you meet every exit criterion."}</p>
                  <Button
                    size="sm"
                    variant={done ? "secondary" : isCurrent ? "primary" : "secondary"}
                    disabled={status !== "ready" || !db}
                    aria-disabled={busy === s.id || undefined}
                    aria-label={`${done ? "Mark as not complete" : "Mark complete"}: stage ${n}, ${s.title}`}
                    onClick={() => toggle(s, n)}
                  >
                    {done ? (
                      "Mark as not complete"
                    ) : (
                      <>
                        <CircleCheck aria-hidden className="h-4 w-4" /> Mark complete
                      </>
                    )}
                  </Button>
                </div>
              </article>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
