/**
 * Exam timer simulator: pure logic.
 *
 * The clock never counts ticks. It stores the wall-clock instant the current
 * running segment started (Date.now()) plus the time banked by earlier
 * segments, and derives elapsed time from `now - segmentStart`. A throttled
 * background tab, a slow render or a missed interval therefore cannot make
 * the timer drift; the next reading is exact again.
 *
 * Everything here is deterministic (the caller passes `now`), so it is unit
 * tested without fake timers (timer-logic.test.ts).
 */

// ------------------------------------------------------------------ clock

export type ClockStatus = "idle" | "running" | "paused";

export interface TimerClock {
  status: ClockStatus;
  /** Epoch ms at which the current running segment started (running only). */
  segmentStart: number | null;
  /** Elapsed ms banked from earlier running segments. */
  banked: number;
}

export const IDLE_CLOCK: TimerClock = { status: "idle", segmentStart: null, banked: 0 };

export function startClock(now: number): TimerClock {
  return { status: "running", segmentStart: now, banked: 0 };
}

export function pauseClock(c: TimerClock, now: number): TimerClock {
  if (c.status !== "running" || c.segmentStart === null) return c;
  return { status: "paused", segmentStart: null, banked: c.banked + Math.max(0, now - c.segmentStart) };
}

export function resumeClock(c: TimerClock, now: number): TimerClock {
  if (c.status !== "paused") return c;
  return { status: "running", segmentStart: now, banked: c.banked };
}

/** Elapsed time, clamped to [0, duration]. A clock set backwards never yields negative time. */
export function elapsedMs(c: TimerClock, now: number, durationMs: number): number {
  const running = c.status === "running" && c.segmentStart !== null ? Math.max(0, now - c.segmentStart) : 0;
  return Math.min(Math.max(0, durationMs), Math.max(0, c.banked + running));
}

export function remainingMs(c: TimerClock, now: number, durationMs: number): number {
  return Math.max(0, durationMs - elapsedMs(c, now, durationMs));
}

/** True once a started run has used its whole duration. */
export function isTimeUp(c: TimerClock, now: number, durationMs: number): boolean {
  return c.status !== "idle" && durationMs > 0 && elapsedMs(c, now, durationMs) >= durationMs;
}

// ------------------------------------------------------------------ formatting

/**
 * "2:59:59" (when the run is an hour or longer) or "59:59". Remaining time is
 * rounded up (it reads 0:00 exactly when time is up); elapsed time rounds down.
 */
export function formatTimer(ms: number, opts: { hours: boolean; round?: "up" | "down" }): string {
  const secs = Math.max(0, opts.round === "up" ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const ss = String(s).padStart(2, "0");
  if (opts.hours) return `${h}:${String(m).padStart(2, "0")}:${ss}`;
  return `${String(h * 60 + m).padStart(2, "0")}:${ss}`;
}

/** Spoken form for screen readers and aria-valuetext: "2 hours 5 minutes", "45 seconds". */
export function spokenDuration(ms: number): string {
  const secs = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const part = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  const parts: string[] = [];
  if (h) parts.push(part(h, "hour"));
  if (m) parts.push(part(m, "minute"));
  if (!h && (s || !m)) parts.push(part(s, "second"));
  return parts.join(" ");
}

/** Minutes as a compact label: 20 → "20 min", 90 → "1 h 30 min", 2.5 → "2.5 min". */
export function minutesLabel(min: number): string {
  if (min < 60) return `${trimNumber(min)} min`;
  const h = Math.floor(min / 60);
  const m = min - h * 60;
  return m ? `${h} h ${trimNumber(m)} min` : `${h} h`;
}

function trimNumber(x: number): string {
  return Number.isInteger(x) ? String(x) : String(Math.round(x * 100) / 100);
}

// ------------------------------------------------------------------ checkpoints

/** A checkpoint as the student edits it (fields may be blank while typing). */
export interface Checkpoint {
  id: string;
  label: string;
  /** Minutes from the start. */
  atMin: number | null;
  /** Questions that should be done by then (optional). */
  targetQuestions: number | null;
}

/** A usable checkpoint: inside the run, sorted by time. */
export interface PlannedCheckpoint {
  id: string;
  label: string;
  atMs: number;
  targetQuestions: number | null;
}

/** Why a checkpoint will be ignored, or null when it is usable. */
export function checkpointIssue(cp: Checkpoint, durationMin: number, totalQuestions: number | null): string | null {
  if (cp.atMin === null || !Number.isFinite(cp.atMin)) return "Enter the minute this checkpoint falls on.";
  if (cp.atMin <= 0) return "The minute must be after the start (greater than 0).";
  if (cp.atMin > durationMin) return `The minute must be within the ${trimNumber(durationMin)}-minute run.`;
  if (cp.targetQuestions !== null) {
    if (!Number.isFinite(cp.targetQuestions) || cp.targetQuestions < 0 || !Number.isInteger(cp.targetQuestions)) return "The target must be a whole number of questions.";
    if (totalQuestions !== null && cp.targetQuestions > totalQuestions) return `The target cannot exceed the ${totalQuestions} questions in the run.`;
  }
  return null;
}

/** The checkpoints that will be used, sorted by time (ties keep their order). Unusable ones are dropped. */
export function planCheckpoints(list: Checkpoint[], durationMin: number, totalQuestions: number | null): PlannedCheckpoint[] {
  return list
    .map((cp, i) => ({ cp, i }))
    .filter(({ cp }) => checkpointIssue(cp, durationMin, totalQuestions) === null)
    .sort((a, b) => a.cp.atMin! - b.cp.atMin! || a.i - b.i)
    .map(({ cp }) => ({
      id: cp.id,
      label: cp.label.trim() || `Checkpoint at ${minutesLabel(cp.atMin!)}`,
      atMs: Math.round(cp.atMin! * 60_000),
      targetQuestions: cp.targetQuestions,
    }));
}

export interface CheckpointProgress {
  /** Checkpoints whose time has been reached. */
  passed: PlannedCheckpoint[];
  /** The most recent checkpoint reached. */
  last: PlannedCheckpoint | null;
  /** The next checkpoint still ahead. */
  next: PlannedCheckpoint | null;
}

export function checkpointProgress(cps: PlannedCheckpoint[], elapsed: number): CheckpointProgress {
  const passed = cps.filter((c) => c.atMs <= elapsed);
  return { passed, last: passed.at(-1) ?? null, next: cps.find((c) => c.atMs > elapsed) ?? null };
}

// ------------------------------------------------------------------ pace

export type PaceState = "ahead" | "behind" | "on-pace";

export interface Pace {
  /** Questions a perfectly even (linear) pace would have finished by now. */
  expected: number;
  /** done − expected (positive = ahead). */
  diff: number;
  state: PaceState;
  /** Whole questions ahead or behind (0 when on pace). */
  questions: number;
}

/**
 * Compare progress with a linear pace (total × elapsed / duration). Within
 * `tolerance` questions of the line counts as on pace. Null when the run has
 * no question total to pace against.
 */
export function linearPace(done: number, total: number | null, elapsed: number, durationMs: number, tolerance = 1): Pace | null {
  if (!total || total <= 0 || durationMs <= 0) return null;
  const expected = (total * Math.min(Math.max(elapsed, 0), durationMs)) / durationMs;
  const diff = done - expected;
  if (Math.abs(diff) < tolerance) return { expected, diff, state: "on-pace", questions: 0 };
  return { expected, diff, state: diff > 0 ? "ahead" : "behind", questions: Math.floor(Math.abs(diff)) };
}

/** Average time per finished question so far, or null before the first one. */
export function timePerQuestion(elapsed: number, done: number): number | null {
  return done > 0 ? elapsed / done : null;
}

export function clampDone(n: number, total: number | null): number {
  const max = total && total > 0 ? total : 999;
  return Math.min(max, Math.max(0, Math.round(n)));
}

// ------------------------------------------------------------------ alerts

/** Remaining-time alerts in minutes (only those shorter than the run are used). */
export const TIME_LEFT_ALERTS = [30, 10, 5, 1] as const;

/**
 * One on-screen alert. Alerts that fall on the same instant are merged into
 * one, so none of them is hidden by another: checkpoints sharing a minute are
 * listed together, a time-left alert at a checkpoint's minute is carried by
 * that checkpoint (`minutesLeft`), and checkpoints set at the very end are
 * carried by the time-up alert.
 */
export type TimerAlert =
  | { key: string; kind: "checkpoint"; atMs: number; checkpoints: PlannedCheckpoint[]; minutesLeft: number | null }
  | { key: string; kind: "time-left"; atMs: number; minutesLeft: number }
  | { key: string; kind: "time-up"; atMs: number; checkpoints: PlannedCheckpoint[] };

/** Every alert the run will raise, in the order they happen (at most one per instant). */
export function alertSchedule(cps: PlannedCheckpoint[], durationMs: number): TimerAlert[] {
  if (durationMs <= 0) return [];
  const byTime = new Map<number, PlannedCheckpoint[]>();
  for (const c of cps) {
    if (c.atMs <= 0 || c.atMs > durationMs) continue;
    const list = byTime.get(c.atMs);
    if (list) list.push(c);
    else byTime.set(c.atMs, [c]);
  }
  // Skip thresholds that are not shorter than the run (a 20-minute run does not "alert" 30 minutes left at the start).
  const timeLeft = TIME_LEFT_ALERTS.map((m) => ({ minutes: m, atMs: durationMs - m * 60_000 })).filter((t) => t.atMs > 0);
  const out: TimerAlert[] = [];
  for (const [atMs, list] of byTime) {
    if (atMs === durationMs) continue;
    const left = timeLeft.find((t) => t.atMs === atMs);
    out.push({ key: `cp:${list.map((c) => c.id).join("+")}:${atMs}`, kind: "checkpoint", atMs, checkpoints: list, minutesLeft: left?.minutes ?? null });
  }
  for (const t of timeLeft) if (!byTime.has(t.atMs)) out.push({ key: `left:${t.minutes}`, kind: "time-left", atMs: t.atMs, minutesLeft: t.minutes });
  out.push({ key: "end", kind: "time-up", atMs: durationMs, checkpoints: byTime.get(durationMs) ?? [] });
  return out.sort((a, b) => a.atMs - b.atMs);
}

/** The most recent alert that has happened by `elapsed` (null before the first one). */
export function latestAlert(schedule: TimerAlert[], elapsed: number): TimerAlert | null {
  let hit: TimerAlert | null = null;
  for (const a of schedule) if (a.atMs <= elapsed) hit = a;
  return hit;
}

// ------------------------------------------------------------------ modes & configuration

export type TimerMode = "full" | "subject" | "custom";

export const FULL_EXAM_MINUTES = 180;
export const FULL_EXAM_QUESTIONS = 65;

/**
 * Example checkpoints for the full paper (GA is Q.1–10, DA 1-mark questions are
 * Q.11–35 and DA 2-mark questions Q.36–65). They are a starting point to edit,
 * not an official or universal recommendation.
 */
export const DEFAULT_FULL_CHECKPOINTS: Checkpoint[] = [
  { id: "ga", label: "General Aptitude done (Q.1–10)", atMin: 20, targetQuestions: 10 },
  { id: "da-1", label: "DA 1-mark questions done (Q.11–35)", atMin: 65, targetQuestions: 35 },
  { id: "da-2", label: "First pass of DA 2-mark questions done (Q.36–65)", atMin: 155, targetQuestions: 65 },
  { id: "review", label: "Review of marked questions finished", atMin: 175, targetQuestions: null },
];

export interface TimerConfig {
  mode: TimerMode;
  fullCheckpoints: Checkpoint[];
  subject: { questions: number | null; minutesPerQuestion: number | null };
  custom: { minutes: number | null; questions: number | null; checkpoints: Checkpoint[] };
}

export const DEFAULT_CONFIG: TimerConfig = {
  mode: "full",
  fullCheckpoints: DEFAULT_FULL_CHECKPOINTS,
  subject: { questions: 10, minutesPerQuestion: 3 },
  custom: { minutes: 60, questions: null, checkpoints: [] },
};

export const LIMITS = {
  subjectQuestions: { min: 1, max: 100 },
  minutesPerQuestion: { min: 0.5, max: 15 },
  customMinutes: { min: 1, max: 600 },
  customQuestions: { min: 1, max: 300 },
  checkpoints: 12,
} as const;

/** A run's fixed plan, frozen when the run starts. */
export interface TimerPlan {
  mode: TimerMode;
  durationMs: number;
  totalQuestions: number | null;
  checkpoints: PlannedCheckpoint[];
}

/** Why the current settings cannot start a run, or null when they can. */
export function configIssue(cfg: TimerConfig): string | null {
  if (cfg.mode === "subject") {
    const { questions: q, minutesPerQuestion: m } = cfg.subject;
    if (q === null || !Number.isInteger(q) || q < LIMITS.subjectQuestions.min || q > LIMITS.subjectQuestions.max)
      return `Enter a whole number of questions from ${LIMITS.subjectQuestions.min} to ${LIMITS.subjectQuestions.max}.`;
    if (m === null || !Number.isFinite(m) || m < LIMITS.minutesPerQuestion.min || m > LIMITS.minutesPerQuestion.max)
      return `Enter minutes per question from ${LIMITS.minutesPerQuestion.min} to ${LIMITS.minutesPerQuestion.max}.`;
  }
  if (cfg.mode === "custom") {
    const { minutes: m, questions: q } = cfg.custom;
    if (m === null || !Number.isFinite(m) || m < LIMITS.customMinutes.min || m > LIMITS.customMinutes.max)
      return `Enter a duration from ${LIMITS.customMinutes.min} to ${LIMITS.customMinutes.max} minutes.`;
    if (q !== null && (!Number.isInteger(q) || q < LIMITS.customQuestions.min || q > LIMITS.customQuestions.max))
      return `Leave the question count empty, or enter a whole number from ${LIMITS.customQuestions.min} to ${LIMITS.customQuestions.max}.`;
  }
  return null;
}

/** Automatic checkpoints for subject practice: a quarter, half and three quarters of the time. */
export function subjectCheckpoints(questions: number, minutesPerQuestion: number): Checkpoint[] {
  const total = questions * minutesPerQuestion;
  if (total < 4) return [];
  return [0.25, 0.5, 0.75].map((f) => ({
    id: `q${f * 100}`,
    label: `${f * 100}% of the time used`,
    atMin: Math.round(total * f * 100) / 100,
    targetQuestions: Math.round(questions * f),
  }));
}

/** The plan the current settings describe (null when they are invalid). */
export function buildPlan(cfg: TimerConfig): TimerPlan | null {
  if (configIssue(cfg)) return null;
  if (cfg.mode === "full") {
    return {
      mode: "full",
      durationMs: FULL_EXAM_MINUTES * 60_000,
      totalQuestions: FULL_EXAM_QUESTIONS,
      checkpoints: planCheckpoints(cfg.fullCheckpoints, FULL_EXAM_MINUTES, FULL_EXAM_QUESTIONS),
    };
  }
  if (cfg.mode === "subject") {
    const q = cfg.subject.questions!;
    const m = cfg.subject.minutesPerQuestion!;
    const minutes = q * m;
    return { mode: "subject", durationMs: Math.round(minutes * 60_000), totalQuestions: q, checkpoints: planCheckpoints(subjectCheckpoints(q, m), minutes, q) };
  }
  const minutes = cfg.custom.minutes!;
  const q = cfg.custom.questions;
  return { mode: "custom", durationMs: Math.round(minutes * 60_000), totalQuestions: q, checkpoints: planCheckpoints(cfg.custom.checkpoints, minutes, q) };
}

// ------------------------------------------------------------------ parsing stored values (untrusted)

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function parseCheckpoints(v: unknown, fallback: Checkpoint[]): Checkpoint[] {
  if (!Array.isArray(v)) return fallback;
  const out: Checkpoint[] = [];
  const seen = new Set<string>();
  for (const x of v.slice(0, LIMITS.checkpoints)) {
    if (!isObj(x) || typeof x.id !== "string" || !x.id || seen.has(x.id)) continue;
    seen.add(x.id);
    out.push({
      id: x.id.slice(0, 40),
      label: typeof x.label === "string" ? x.label.slice(0, 120) : "",
      atMin: numOrNull(x.atMin),
      targetQuestions: numOrNull(x.targetQuestions),
    });
  }
  return out;
}

/** Settings saved in local storage; anything malformed falls back to the defaults. */
export function parseConfig(raw: string | null): TimerConfig {
  if (!raw) return DEFAULT_CONFIG;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return DEFAULT_CONFIG;
  }
  if (!isObj(v)) return DEFAULT_CONFIG;
  const mode: TimerMode = v.mode === "subject" || v.mode === "custom" ? v.mode : "full";
  const subject = isObj(v.subject) ? v.subject : {};
  const custom = isObj(v.custom) ? v.custom : {};
  return {
    mode,
    fullCheckpoints: parseCheckpoints(v.fullCheckpoints, DEFAULT_FULL_CHECKPOINTS),
    subject: {
      questions: "questions" in subject ? numOrNull(subject.questions) : DEFAULT_CONFIG.subject.questions,
      minutesPerQuestion: "minutesPerQuestion" in subject ? numOrNull(subject.minutesPerQuestion) : DEFAULT_CONFIG.subject.minutesPerQuestion,
    },
    custom: {
      minutes: "minutes" in custom ? numOrNull(custom.minutes) : DEFAULT_CONFIG.custom.minutes,
      questions: "questions" in custom ? numOrNull(custom.questions) : DEFAULT_CONFIG.custom.questions,
      checkpoints: parseCheckpoints(custom.checkpoints, []),
    },
  };
}

/** A run in progress (kept in session storage so a reload or a detour to another page keeps it). */
export interface TimerRun {
  plan: TimerPlan;
  clock: TimerClock;
  done: number;
  /** Key of the alert the student dismissed (it stays hidden until the next alert). */
  dismissed: string | null;
}

export function parseRun(raw: string | null): TimerRun | null {
  if (!raw) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(v) || !isObj(v.plan) || !isObj(v.clock)) return null;
  const p = v.plan;
  const c = v.clock;
  const durationMs = numOrNull(p.durationMs);
  if (durationMs === null || durationMs <= 0) return null;
  const mode: TimerMode = p.mode === "subject" || p.mode === "custom" ? p.mode : "full";
  const total = numOrNull(p.totalQuestions);
  const checkpoints: PlannedCheckpoint[] = Array.isArray(p.checkpoints)
    ? p.checkpoints
        .filter((x): x is Record<string, unknown> => isObj(x) && typeof x.id === "string" && typeof x.label === "string" && numOrNull(x.atMs) !== null)
        .map((x) => ({ id: x.id as string, label: x.label as string, atMs: x.atMs as number, targetQuestions: numOrNull(x.targetQuestions) }))
        .filter((x) => x.atMs > 0 && x.atMs <= durationMs)
        .sort((a, b) => a.atMs - b.atMs)
    : [];
  const status: ClockStatus = c.status === "running" || c.status === "paused" ? c.status : "idle";
  if (status === "idle") return null;
  const segmentStart = status === "running" ? numOrNull(c.segmentStart) : null;
  if (status === "running" && segmentStart === null) return null;
  const banked = Math.max(0, numOrNull(c.banked) ?? 0);
  const done = numOrNull(v.done) ?? 0;
  return {
    plan: { mode, durationMs, totalQuestions: total !== null && total > 0 ? Math.round(total) : null, checkpoints },
    clock: { status, segmentStart, banked },
    done: clampDone(done, total),
    dismissed: typeof v.dismissed === "string" ? v.dismissed : null,
  };
}
