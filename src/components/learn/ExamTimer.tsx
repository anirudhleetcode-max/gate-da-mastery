"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlarmClock, BellRing, Check, Circle, CircleCheck, CircleDot, Flag, Minus, Pause, Play, Plus, RotateCcw, Trash2, TrendingDown, TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ProgressBar } from "@/components/ui/Progress";
import { Segmented } from "@/components/ui/Segmented";
import { cn, formatDuration, plural } from "@/lib/utils";
import { usePersistentValue } from "./persist";
import {
  DEFAULT_FULL_CHECKPOINTS,
  FULL_EXAM_MINUTES,
  FULL_EXAM_QUESTIONS,
  LIMITS,
  alertSchedule,
  buildPlan,
  checkpointIssue,
  checkpointProgress,
  clampDone,
  configIssue,
  elapsedMs,
  formatTimer,
  isTimeUp,
  latestAlert,
  linearPace,
  minutesLabel,
  parseConfig,
  parseRun,
  pauseClock,
  remainingMs,
  resumeClock,
  spokenDuration,
  startClock,
  timePerQuestion,
  type Checkpoint,
  type PlannedCheckpoint,
  type TimerAlert,
  type TimerConfig,
  type TimerMode,
  type TimerRun,
} from "./timer-logic";

const CONFIG_KEY = "gate-da-timer-config";
const RUN_KEY = "gate-da-timer-run";

const MODE_LABEL: Record<TimerMode, string> = { full: "Full exam", subject: "Subject practice", custom: "Custom" };

const SETTINGS_ISSUE_ID = "timer-settings-issue";

/** A required number within [min, max] (whole when `int`); an optional one may also be empty. */
const outOfRange = (v: number | null, r: { min: number; max: number }, int: boolean, optional = false) =>
  v === null ? !optional : !Number.isFinite(v) || (int && !Number.isInteger(v)) || v < r.min || v > r.max;

const numberOrNull = (s: string): number | null => {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export function ExamTimer() {
  const [rawCfg, setRawCfg] = usePersistentValue("local", CONFIG_KEY);
  const [rawRun, setRawRun] = usePersistentValue("session", RUN_KEY);
  const cfg = useMemo(() => parseConfig(rawCfg), [rawCfg]);
  const run = useMemo(() => parseRun(rawRun), [rawRun]);
  const [now, setNow] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const clockRef = useRef<HTMLDivElement>(null);

  const saveCfg = (next: TimerConfig) => setRawCfg(JSON.stringify(next));
  const saveRun = (next: TimerRun | null) => setRawRun(next ? JSON.stringify(next) : null);

  const draftPlan = useMemo(() => buildPlan(cfg), [cfg]);
  const plan = run?.plan ?? draftPlan;
  const issue = configIssue(cfg);
  const durationMs = plan?.durationMs ?? 0;
  const hours = durationMs >= 3_600_000;
  const clock = run?.clock;
  const elapsed = clock ? elapsedMs(clock, now, durationMs) : 0;
  const remaining = clock ? remainingMs(clock, now, durationMs) : durationMs;
  const timeUp = clock ? isTimeUp(clock, now, durationMs) : false;
  const ticking = clock?.status === "running" && !timeUp;
  const total = plan?.totalQuestions ?? null;
  const done = run?.done ?? 0;

  // Re-read the wall clock 4× a second while running. Elapsed time always comes from
  // Date.now() deltas (timer-logic.ts), so throttled or missed ticks cannot cause drift.
  useEffect(() => {
    if (!ticking) return;
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [ticking]);

  // Show the remaining time in the tab title while a run is active (write-only effect).
  const titleText = run ? (timeUp ? "Time's up" : `${formatTimer(remaining, { hours, round: "up" })} left${clock?.status === "paused" ? " (paused)" : ""}`) : null;
  useEffect(() => {
    if (!titleText) return;
    const original = document.title;
    const ours = `${titleText} · Exam timer`;
    document.title = ours;
    return () => {
      // Restore only if nothing else (e.g. the next page's metadata) has set the title since.
      if (document.title === ours) document.title = original;
    };
  }, [titleText]);

  const schedule = useMemo(() => (plan ? alertSchedule(plan.checkpoints, plan.durationMs) : []), [plan]);
  const alert = run ? latestAlert(schedule, elapsed) : null;
  const visibleAlert = alert && alert.key !== run?.dismissed ? alert : null;
  const progress = plan ? checkpointProgress(plan.checkpoints, elapsed) : { passed: [], last: null, next: null };
  const pace = run ? linearPace(done, total, elapsed, durationMs) : null;
  const perQuestion = timePerQuestion(elapsed, done);
  const budgetPerQuestion = total ? durationMs / total : null;

  // ---------------------------------------------------------------- actions
  function start() {
    const p = buildPlan(cfg);
    if (!p) return;
    const t = Date.now();
    setNow(t);
    saveRun({ plan: p, clock: startClock(t), done: 0, dismissed: null });
  }
  function pause() {
    if (!run) return;
    const t = Date.now();
    setNow(t);
    saveRun({ ...run, clock: pauseClock(run.clock, t) });
  }
  function resume() {
    if (!run) return;
    const t = Date.now();
    setNow(t);
    saveRun({ ...run, clock: resumeClock(run.clock, t) });
  }
  function reset() {
    saveRun(null);
    setNow(0);
    setConfirmReset(false);
  }
  function bump(delta: number) {
    if (!run) return;
    saveRun({ ...run, done: clampDone(run.done + delta, run.plan.totalQuestions) });
  }
  function dismiss() {
    if (!run || !alert) return;
    saveRun({ ...run, dismissed: alert.key });
    clockRef.current?.focus();
  }

  const status: { label: string; icon: ReactNode } = !run
    ? { label: "Not started", icon: <Circle aria-hidden className="h-4 w-4" /> }
    : timeUp
      ? { label: "Time's up", icon: <BellRing aria-hidden className="h-4 w-4" /> }
      : clock?.status === "paused"
        ? { label: "Paused", icon: <Pause aria-hidden className="h-4 w-4" /> }
        : { label: "Running", icon: <Play aria-hidden className="h-4 w-4" /> };

  const lowTime = run && !timeUp && remaining <= 10 * 60_000 && durationMs > 10 * 60_000;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-fg-2" aria-hidden>
          Mode
        </span>
        {/* The fieldset only disables the mode switch during a run; the radio group carries the name. */}
        <fieldset disabled={Boolean(run)} className="w-full min-w-0 disabled:opacity-60 sm:w-auto">
          <Segmented<TimerMode>
            label="Timer mode"
            value={cfg.mode}
            onChange={(m) => saveCfg({ ...cfg, mode: m })}
            options={[
              { value: "full", label: MODE_LABEL.full },
              { value: "subject", label: "Subject practice" },
              { value: "custom", label: MODE_LABEL.custom },
            ]}
            className="flex w-full sm:inline-flex sm:w-auto [&>button]:min-h-10 [&>button]:flex-1 [&>button]:px-2 sm:[&>button]:min-h-0 sm:[&>button]:flex-none sm:[&>button]:px-3"
          />
        </fieldset>
        {run ? <p className="text-sm text-fg-3">Reset the timer to change the mode or settings.</p> : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,23rem)] lg:items-start">
        {/* ------------------------------------------------------------ clock */}
        <section aria-labelledby="timer-h" className="min-w-0 rounded-[var(--radius)] border border-border bg-surface shadow-[var(--shadow)]">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
            <h2 id="timer-h" className="font-semibold text-fg">
              {MODE_LABEL[plan?.mode ?? cfg.mode]}
            </h2>
            <p className="tnum text-sm text-fg-3">
              {plan ? (
                <>
                  {minutesLabel(plan.durationMs / 60_000)}
                  {plan.totalQuestions ? ` · ${plural(plan.totalQuestions, "question")}` : " · no question count"}
                  {plan.checkpoints.length ? ` · ${plural(plan.checkpoints.length, "checkpoint")}` : ""}
                </>
              ) : (
                "Settings incomplete"
              )}
            </p>
          </div>

          <div className="space-y-5 px-4 py-5 sm:px-5">
            {/* Screen readers hear each alert once, when it happens (the text only changes on a new alert). */}
            <p role="status" aria-live="polite" className="sr-only">
              {alert ? announcement(alert, hours) : ""}
            </p>
            {visibleAlert ? <AlertBanner alert={visibleAlert} done={done} hours={hours} onDismiss={dismiss} /> : null}

            <div ref={clockRef} tabIndex={-1} className="rounded-lg text-center focus-visible:outline-offset-4">
              <p id="remaining-label" className="text-xs font-semibold uppercase tracking-wide text-fg-3">
                Time remaining
              </p>
              <p
                role="timer"
                aria-labelledby="remaining-label"
                aria-describedby="timer-spoken"
                className={cn("tnum mt-1 text-5xl font-semibold leading-none tracking-tight sm:text-7xl", timeUp ? "text-danger" : lowTime ? "text-warning" : "text-fg")}
              >
                {formatTimer(remaining, { hours, round: "up" })}
              </p>
              <p id="timer-spoken" className="sr-only">
                {spokenDuration(Math.ceil(remaining / 1000) * 1000)} remaining
              </p>
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm font-medium text-fg-2">
                {status.icon}
                {status.label}
                {lowTime ? <span className="text-warning">· under 10 minutes left</span> : null}
              </p>
            </div>

            <div className="space-y-1.5">
              <ProgressBar value={Math.round(elapsed / 1000)} max={Math.max(1, Math.round(durationMs / 1000))} label="Time used" tone={timeUp ? "danger" : lowTime ? "warning" : "accent"} />
              <div className="tnum flex justify-between text-xs text-fg-3">
                <span>
                  Elapsed <span className="font-medium text-fg-2">{formatTimer(elapsed, { hours })}</span>
                </span>
                <span>
                  Total <span className="font-medium text-fg-2">{formatTimer(durationMs, { hours })}</span>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              {!run ? (
                <Button variant="primary" size="lg" onClick={start} disabled={Boolean(issue) || !plan} aria-describedby={issue ? "timer-issue" : undefined} className="min-w-40">
                  <Play aria-hidden className="h-5 w-5" /> Start
                </Button>
              ) : clock?.status === "running" && !timeUp ? (
                <Button variant="primary" size="lg" onClick={pause} className="min-w-40">
                  <Pause aria-hidden className="h-5 w-5" /> Pause
                </Button>
              ) : !timeUp ? (
                <Button variant="primary" size="lg" onClick={resume} className="min-w-40">
                  <Play aria-hidden className="h-5 w-5" /> Resume
                </Button>
              ) : null}
              {run ? (
                <Button size="lg" onClick={() => setConfirmReset(true)}>
                  <RotateCcw aria-hidden className="h-5 w-5" /> Reset
                </Button>
              ) : null}
            </div>
            {issue && !run ? (
              <p id="timer-issue" className="text-center text-sm text-danger">
                {issue}
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              {/* questions counter */}
              <div role="group" aria-labelledby="done-label" className="rounded-lg border border-border px-3 py-3">
                <p id="done-label" className="text-xs font-semibold uppercase tracking-wide text-fg-3">
                  Questions done
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <Button onClick={() => bump(-1)} disabled={!run || done <= 0} aria-label="One question fewer" className="h-11 w-11 px-0">
                    <Minus aria-hidden className="h-5 w-5" />
                  </Button>
                  <p className="tnum text-center text-3xl font-semibold text-fg" aria-live="polite" aria-atomic="true">
                    {done}
                    {total ? <span className="text-base font-normal text-fg-3"> / {total}</span> : null}
                    <span className="sr-only"> questions done</span>
                  </p>
                  <Button onClick={() => bump(1)} disabled={!run || (total !== null && done >= total)} aria-label="One more question done" className="h-11 w-11 px-0">
                    <Plus aria-hidden className="h-5 w-5" />
                  </Button>
                </div>
                <p className="mt-2 text-xs text-fg-3">
                  {perQuestion !== null ? (
                    <>
                      {formatDuration(perQuestion)} per question so far
                      {budgetPerQuestion ? <> (even pace: {formatDuration(budgetPerQuestion)})</> : null}
                    </>
                  ) : run ? (
                    "Press + each time you finish a question."
                  ) : (
                    "Counts the questions you finish once the timer starts."
                  )}
                </p>
              </div>

              {/* pace */}
              <div className="rounded-lg border border-border px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-fg-3">Pace</p>
                <PaceReadout pace={pace} running={Boolean(run)} total={total} />
              </div>
            </div>

            <CheckpointPanel
              checkpoints={plan?.checkpoints ?? []}
              elapsed={elapsed}
              done={done}
              hours={hours}
              started={Boolean(run)}
              last={progress.last}
              next={progress.next}
              mode={plan?.mode ?? cfg.mode}
            />
          </div>
        </section>

        {/* ------------------------------------------------------------ settings */}
        <aside className="min-w-0 space-y-4">
          <section aria-labelledby="settings-h" className="rounded-[var(--radius)] border border-border bg-surface shadow-[var(--shadow)]">
            <div className="border-b border-border px-4 py-3">
              <h2 id="settings-h" className="font-semibold text-fg">
                {MODE_LABEL[cfg.mode]} settings
              </h2>
              <p className="mt-0.5 text-sm text-fg-3">Saved on this device.{run ? " Locked while the timer is set." : ""}</p>
            </div>
            <fieldset disabled={Boolean(run)} className="min-w-0 space-y-4 px-4 py-4 disabled:opacity-70">
              <legend className="sr-only">{MODE_LABEL[cfg.mode]} settings</legend>
              {cfg.mode === "full" ? (
                <>
                  <p className="text-sm text-fg-2">
                    {FULL_EXAM_MINUTES} minutes and {FULL_EXAM_QUESTIONS} questions, as in the GATE DA paper: General Aptitude is Q.1–10, the DA section Q.11–65.
                  </p>
                  <CheckpointEditor
                    list={cfg.fullCheckpoints}
                    durationMin={FULL_EXAM_MINUTES}
                    total={FULL_EXAM_QUESTIONS}
                    onChange={(list) => saveCfg({ ...cfg, fullCheckpoints: list })}
                    onRestore={() => saveCfg({ ...cfg, fullCheckpoints: DEFAULT_FULL_CHECKPOINTS })}
                    idPrefix="full"
                  />
                </>
              ) : cfg.mode === "subject" ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <NumberField
                      id="subject-questions"
                      label="Questions"
                      value={cfg.subject.questions}
                      min={LIMITS.subjectQuestions.min}
                      max={LIMITS.subjectQuestions.max}
                      step={1}
                      onChange={(v) => saveCfg({ ...cfg, subject: { ...cfg.subject, questions: v } })}
                      invalid={outOfRange(cfg.subject.questions, LIMITS.subjectQuestions, true)}
                    />
                    <NumberField
                      id="subject-mpq"
                      label="Minutes per question"
                      value={cfg.subject.minutesPerQuestion}
                      min={LIMITS.minutesPerQuestion.min}
                      max={LIMITS.minutesPerQuestion.max}
                      step={0.5}
                      onChange={(v) => saveCfg({ ...cfg, subject: { ...cfg.subject, minutesPerQuestion: v } })}
                      invalid={outOfRange(cfg.subject.minutesPerQuestion, LIMITS.minutesPerQuestion, false)}
                    />
                  </div>
                  <p className="text-sm text-fg-2">
                    {draftPlan && cfg.mode === "subject" ? (
                      <>
                        Duration: <span className="tnum font-semibold text-fg">{minutesLabel(draftPlan.durationMs / 60_000)}</span>. Checkpoints are set automatically at a
                        quarter, half and three quarters of the time.
                      </>
                    ) : (
                      "The duration is questions × minutes per question."
                    )}
                  </p>
                  <p className="text-xs text-fg-3">
                    For reference, the full paper allows about {formatDuration((FULL_EXAM_MINUTES * 60_000) / FULL_EXAM_QUESTIONS)} per question on average; 2-mark questions usually
                    need more than 1-mark ones.
                  </p>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <NumberField
                      id="custom-minutes"
                      label="Minutes"
                      value={cfg.custom.minutes}
                      min={LIMITS.customMinutes.min}
                      max={LIMITS.customMinutes.max}
                      step={1}
                      onChange={(v) => saveCfg({ ...cfg, custom: { ...cfg.custom, minutes: v } })}
                      invalid={outOfRange(cfg.custom.minutes, LIMITS.customMinutes, false)}
                    />
                    <NumberField
                      id="custom-questions"
                      label="Questions (optional)"
                      value={cfg.custom.questions}
                      min={LIMITS.customQuestions.min}
                      max={LIMITS.customQuestions.max}
                      step={1}
                      onChange={(v) => saveCfg({ ...cfg, custom: { ...cfg.custom, questions: v } })}
                      hint="Needed for the pace check."
                      invalid={outOfRange(cfg.custom.questions, LIMITS.customQuestions, true, true)}
                    />
                  </div>
                  <CheckpointEditor
                    list={cfg.custom.checkpoints}
                    durationMin={cfg.custom.minutes ?? 0}
                    total={cfg.custom.questions}
                    onChange={(list) => saveCfg({ ...cfg, custom: { ...cfg.custom, checkpoints: list } })}
                    idPrefix="custom"
                  />
                </>
              )}
              {issue ? (
                <p id={SETTINGS_ISSUE_ID} className="text-sm text-danger">
                  {issue}
                </p>
              ) : null}
            </fieldset>
          </section>

          <div className="rounded-[var(--radius)] border border-border bg-surface px-4 py-3 text-sm text-fg-2">
            <h2 className="font-semibold text-fg">How it works</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>The clock reads your device&apos;s time, so it stays accurate if the tab is in the background. It keeps running if you open another page in this tab; closing the tab ends the run.</li>
              <li>Checkpoint and time alerts appear on screen (no sound), and screen readers announce them.</li>
              <li>Pace compares your count with an even pace through the whole run.</li>
              <li>The example checkpoints are one way to split the paper, not an official or universal plan. There is no single correct order; adjust them after each mock.</li>
            </ul>
          </div>
        </aside>
      </div>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset} title="Reset the timer?" description="The elapsed time and your question count for this run are cleared. Your settings are kept.">
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={() => setConfirmReset(false)}>Keep the run</Button>
          <Button variant="danger" onClick={reset}>
            Reset
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

// ------------------------------------------------------------------ alerts

function announcement(a: TimerAlert, hours: boolean): string {
  if (a.kind === "checkpoint") {
    const items = a.checkpoints.map((c) => `${c.label}.${c.targetQuestions !== null ? ` Target: ${plural(c.targetQuestions, "question")} done.` : ""}`);
    return `Checkpoint at ${formatTimer(a.atMs, { hours })}: ${items.join(" ")}${a.minutesLeft !== null ? ` ${plural(a.minutesLeft, "minute")} left.` : ""}`;
  }
  if (a.kind === "time-left") return `${plural(a.minutesLeft, "minute")} left.`;
  return `Time is up.${a.checkpoints.length ? ` Final checkpoint: ${a.checkpoints.map((c) => c.label).join("; ")}.` : ""}`;
}

/** A checkpoint's label with the student's count against its target. */
function CheckpointLine({ c, done }: { c: PlannedCheckpoint; done: number }) {
  const t = c.targetQuestions;
  return (
    <span className="block">
      <span className="font-medium text-fg">{c.label}</span>
      {t !== null ? (
        <span className="block">
          Target {plural(t, "question")}; you have done <span className="tnum font-semibold text-fg">{done}</span>
          {done >= t ? " (on target)." : ` (${t - done} short).`}
        </span>
      ) : null}
    </span>
  );
}

function AlertBanner({ alert, done, hours, onDismiss }: { alert: TimerAlert; done: number; hours: boolean; onDismiss: () => void }) {
  const tone = alert.kind === "checkpoint" ? "border-accent bg-accent-soft" : alert.kind === "time-left" ? "border-warning bg-warning-soft" : "border-danger bg-danger-soft";
  const Icon = alert.kind === "checkpoint" ? Flag : alert.kind === "time-left" ? AlarmClock : BellRing;
  const iconTone = alert.kind === "checkpoint" ? "text-accent-text" : alert.kind === "time-left" ? "text-warning" : "text-danger";
  let title: string;
  let detail: ReactNode = null;
  if (alert.kind === "checkpoint") {
    title = `Checkpoint · ${formatTimer(alert.atMs, { hours })}${alert.minutesLeft !== null ? ` · ${plural(alert.minutesLeft, "minute")} left` : ""}`;
    detail = (
      <span className="block space-y-1">
        {alert.checkpoints.map((c) => (
          <CheckpointLine key={c.id} c={c} done={done} />
        ))}
      </span>
    );
  } else if (alert.kind === "time-left") {
    title = `${plural(alert.minutesLeft, "minute")} left`;
    detail = alert.minutesLeft <= 5 ? "Stop starting long questions; make sure every answer you mean to give is entered." : "Check that the questions you have left fit the time.";
  } else {
    title = "Time is up";
    detail = (
      <span className="block space-y-1">
        <span className="block">In the exam the paper submits itself now. Count the questions you finished and compare with your plan.</span>
        {alert.checkpoints.map((c) => (
          <CheckpointLine key={c.id} c={c} done={done} />
        ))}
      </span>
    );
  }
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border-2 px-3 py-2.5", tone)}>
      <Icon aria-hidden className={cn("mt-0.5 h-5 w-5 shrink-0", iconTone)} />
      <div className="min-w-0 flex-1 text-sm text-fg-2">
        <p className="font-semibold text-fg">{title}</p>
        <div className="mt-0.5">{detail}</div>
      </div>
      <button type="button" onClick={onDismiss} className="-m-1.5 grid h-10 w-10 shrink-0 place-items-center rounded-md text-fg-2 hover:bg-surface hover:text-fg" aria-label="Dismiss this alert">
        <X aria-hidden className="h-4 w-4" />
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ pace

function PaceReadout({ pace, running, total }: { pace: ReturnType<typeof linearPace>; running: boolean; total: number | null }) {
  if (!total) return <p className="mt-2 text-sm text-fg-3">Set a question count to compare your pace with an even pace.</p>;
  if (!running || !pace) return <p className="mt-2 text-sm text-fg-3">Starts with the timer: your count against an even pace through the run.</p>;
  const view =
    pace.state === "ahead"
      ? { Icon: TrendingUp, text: `Ahead by ${plural(Math.max(1, pace.questions), "question")}`, tone: "text-success" }
      : pace.state === "behind"
        ? { Icon: TrendingDown, text: `Behind by ${plural(Math.max(1, pace.questions), "question")}`, tone: "text-danger" }
        : { Icon: Check, text: "On pace", tone: "text-fg" };
  return (
    <>
      <p className={cn("mt-2 flex items-center gap-2 text-xl font-semibold", view.tone)}>
        <view.Icon aria-hidden className="h-5 w-5" />
        <span>{view.text}</span>
      </p>
      <p className="tnum mt-1 text-xs text-fg-3">
        An even pace would have finished {pace.expected.toFixed(1)} of {total} by now.
      </p>
    </>
  );
}

// ------------------------------------------------------------------ checkpoints

function CheckpointPanel({
  checkpoints,
  elapsed,
  done,
  hours,
  started,
  last,
  next,
  mode,
}: {
  checkpoints: PlannedCheckpoint[];
  elapsed: number;
  done: number;
  hours: boolean;
  started: boolean;
  last: PlannedCheckpoint | null;
  next: PlannedCheckpoint | null;
  mode: TimerMode;
}) {
  return (
    <div className="rounded-lg border border-border">
      <h3 className="border-b border-border px-3 py-2 text-sm font-semibold text-fg">Checkpoints</h3>
      {checkpoints.length ? (
        <>
          <div className="grid gap-3 border-b border-border px-3 py-3 text-sm sm:grid-cols-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-fg-3">Current checkpoint</p>
              {next ? (
                <>
                  <p className="mt-0.5 font-medium text-fg">{next.label}</p>
                  <p className="tnum text-fg-2">
                    at {formatTimer(next.atMs, { hours })}
                    {started ? <> · in {formatTimer(next.atMs - elapsed, { hours: false, round: "up" })}</> : null}
                    {next.targetQuestions !== null ? (
                      <>
                        {" "}
                        · target {next.targetQuestions}
                        {started ? <> ({Math.max(0, next.targetQuestions - done)} to go)</> : null}
                      </>
                    ) : null}
                  </p>
                </>
              ) : (
                <p className="mt-0.5 text-fg-2">All checkpoints passed.</p>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-fg-3">Last checkpoint</p>
              {last ? (
                <>
                  <p className="mt-0.5 font-medium text-fg">{last.label}</p>
                  <p className="tnum text-fg-2">
                    at {formatTimer(last.atMs, { hours })}
                    {last.targetQuestions !== null ? (
                      <>
                        {" "}
                        · target {last.targetQuestions}, you have {done}
                        {done >= last.targetQuestions ? " (on target)" : ` (${last.targetQuestions - done} short)`}
                      </>
                    ) : null}
                  </p>
                </>
              ) : (
                <p className="mt-0.5 text-fg-2">{started ? "None reached yet." : "Not started."}</p>
              )}
            </div>
          </div>
          <ol className="divide-y divide-border">
            {checkpoints.map((c) => {
              const passed = started && c.atMs <= elapsed;
              const isNext = started && next?.id === c.id;
              const stateText = passed ? "Passed" : isNext ? "Next" : "Upcoming";
              return (
                <li key={c.id} className={cn("flex items-start gap-2.5 px-3 py-2 text-sm", isNext && "bg-accent-soft")}>
                  {passed ? (
                    <CircleCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  ) : isNext ? (
                    <CircleDot aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-accent-text" />
                  ) : (
                    <Circle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-fg-3" />
                  )}
                  <span className="tnum w-16 shrink-0 font-medium text-fg">{formatTimer(c.atMs, { hours })}</span>
                  <span className="min-w-0 flex-1 text-fg-2">
                    {c.label}
                    {c.targetQuestions !== null ? <span className="tnum text-fg-3"> · {plural(c.targetQuestions, "question")}</span> : null}
                    <span className={cn("block text-xs sm:hidden", passed ? "text-success" : isNext ? "font-medium text-accent-text" : "text-fg-3")}>{stateText}</span>
                  </span>
                  <span className={cn("hidden shrink-0 text-xs sm:inline", passed ? "text-success" : isNext ? "font-medium text-accent-text" : "text-fg-3")}>{stateText}</span>
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <p className="px-3 py-3 text-sm text-fg-3">
          {mode === "custom"
            ? "No checkpoints. Add some in the settings to get an alert at each one."
            : mode === "subject"
              ? "Runs shorter than 4 minutes have no automatic checkpoints."
              : "No checkpoints. Add some in the settings, or restore the example checkpoints."}
        </p>
      )}
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  min,
  max,
  step,
  onChange,
  hint,
  invalid = false,
}: {
  id: string;
  label: string;
  value: number | null;
  min: number;
  max: number;
  step: number;
  onChange: (v: number | null) => void;
  hint?: string;
  /** Marks the field invalid and points it at the settings' issue message. */
  invalid?: boolean;
}) {
  const describedBy = [hint ? `${id}-hint` : null, invalid ? SETTINGS_ISSUE_ID : null].filter(Boolean).join(" ");
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-fg-3">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={value ?? ""}
        onChange={(e) => onChange(numberOrNull(e.target.value))}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy || undefined}
        className="tnum h-10 w-full min-w-0 rounded-lg border border-border bg-surface px-2.5 text-sm text-fg disabled:bg-surface-2 aria-[invalid=true]:border-danger"
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-fg-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function CheckpointEditor({
  list,
  durationMin,
  total,
  onChange,
  onRestore,
  idPrefix,
}: {
  list: Checkpoint[];
  durationMin: number;
  total: number | null;
  onChange: (list: Checkpoint[]) => void;
  onRestore?: () => void;
  idPrefix: string;
}) {
  const update = (i: number, patch: Partial<Checkpoint>) => onChange(list.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const remove = (i: number) => onChange(list.filter((_, j) => j !== i));
  const add = () => {
    const lastMin = list.reduce((m, c) => Math.max(m, c.atMin ?? 0), 0);
    const suggested = durationMin > 0 ? Math.min(durationMin, Math.round(lastMin + Math.max(1, durationMin / 4))) : null;
    onChange([...list, { id: `cp-${Date.now().toString(36)}`, label: "", atMin: suggested, targetQuestions: null }]);
  };
  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="text-sm font-semibold text-fg">Checkpoints</legend>
      {list.length ? (
        <ol className="space-y-3">
          {list.map((c, i) => {
            const problem = checkpointIssue(c, durationMin, total);
            // The minute is at fault when the checkpoint is unusable even without a target; otherwise the target is.
            const minuteBad = problem !== null && checkpointIssue({ ...c, targetQuestions: null }, durationMin, total) !== null;
            const targetBad = problem !== null && !minuteBad;
            const base = `${idPrefix}-cp-${i}`;
            return (
              <li key={c.id} className="rounded-lg border border-border bg-surface-2/50 p-2.5">
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
                  <div className="col-span-3 flex min-w-0 flex-col gap-1">
                    <label htmlFor={`${base}-label`} className="text-xs font-medium text-fg-3">
                      Checkpoint {i + 1}: what should be done
                    </label>
                    <input
                      id={`${base}-label`}
                      type="text"
                      value={c.label}
                      maxLength={120}
                      onChange={(e) => update(i, { label: e.target.value })}
                      placeholder="e.g. General Aptitude done"
                      className="h-10 w-full min-w-0 rounded-lg border border-border bg-surface px-2.5 text-sm text-fg placeholder:text-fg-3 disabled:bg-surface-2"
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <label htmlFor={`${base}-min`} className="text-xs font-medium text-fg-3">
                      At minute
                    </label>
                    <input
                      id={`${base}-min`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={durationMin || undefined}
                      step="any"
                      value={c.atMin ?? ""}
                      onChange={(e) => update(i, { atMin: numberOrNull(e.target.value) })}
                      aria-invalid={minuteBad || undefined}
                      aria-describedby={minuteBad ? `${base}-issue` : undefined}
                      className="tnum h-10 w-full min-w-0 rounded-lg border border-border bg-surface px-2.5 text-sm text-fg disabled:bg-surface-2 aria-[invalid=true]:border-danger"
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <label htmlFor={`${base}-target`} className="text-xs font-medium text-fg-3">
                      Target questions
                    </label>
                    <input
                      id={`${base}-target`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={total ?? undefined}
                      step={1}
                      value={c.targetQuestions ?? ""}
                      placeholder="optional"
                      onChange={(e) => update(i, { targetQuestions: numberOrNull(e.target.value) })}
                      aria-invalid={targetBad || undefined}
                      aria-describedby={targetBad ? `${base}-issue` : undefined}
                      className="tnum h-10 w-full min-w-0 rounded-lg border border-border bg-surface px-2.5 text-sm text-fg placeholder:text-fg-3 disabled:bg-surface-2 aria-[invalid=true]:border-danger"
                    />
                  </div>
                  <Button onClick={() => remove(i)} aria-label={`Remove checkpoint ${i + 1}${c.label ? `: ${c.label}` : ""}`} className="h-10 w-10 px-0" variant="ghost">
                    <Trash2 aria-hidden className="h-4 w-4" />
                  </Button>
                </div>
                {problem ? (
                  <p id={`${base}-issue`} className="mt-1.5 text-xs text-danger">
                    {problem} It is skipped until fixed.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-sm text-fg-3">No checkpoints yet.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={add} disabled={list.length >= LIMITS.checkpoints || durationMin <= 0}>
          <Plus aria-hidden className="h-4 w-4" /> Add checkpoint
        </Button>
        {onRestore ? (
          <Button size="sm" variant="ghost" onClick={onRestore}>
            <RotateCcw aria-hidden className="h-4 w-4" /> Restore example checkpoints
          </Button>
        ) : null}
      </div>
    </fieldset>
  );
}
