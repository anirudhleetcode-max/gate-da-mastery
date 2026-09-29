import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  DEFAULT_FULL_CHECKPOINTS,
  FULL_EXAM_MINUTES,
  IDLE_CLOCK,
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
  planCheckpoints,
  remainingMs,
  resumeClock,
  spokenDuration,
  startClock,
  subjectCheckpoints,
  timePerQuestion,
  type Checkpoint,
  type TimerConfig,
} from "./timer-logic";

const MIN = 60_000;
const T0 = 1_700_000_000_000;

describe("clock", () => {
  it("derives elapsed time from wall-clock deltas, not from ticks", () => {
    const c = startClock(T0);
    expect(elapsedMs(c, T0, 180 * MIN)).toBe(0);
    // However rarely the UI renders, the reading is exact.
    expect(elapsedMs(c, T0 + 12 * MIN + 345, 180 * MIN)).toBe(12 * MIN + 345);
    expect(remainingMs(c, T0 + 30 * MIN, 180 * MIN)).toBe(150 * MIN);
  });

  it("does not count paused time and resumes where it stopped", () => {
    let c = startClock(T0);
    c = pauseClock(c, T0 + 10 * MIN);
    expect(c.status).toBe("paused");
    expect(elapsedMs(c, T0 + 55 * MIN, 180 * MIN)).toBe(10 * MIN);
    c = resumeClock(c, T0 + 55 * MIN);
    expect(elapsedMs(c, T0 + 60 * MIN, 180 * MIN)).toBe(15 * MIN);
    c = pauseClock(c, T0 + 61 * MIN);
    c = resumeClock(c, T0 + 90 * MIN);
    expect(elapsedMs(c, T0 + 92 * MIN, 180 * MIN)).toBe(18 * MIN);
  });

  it("ignores pause/resume in the wrong state", () => {
    expect(pauseClock(IDLE_CLOCK, T0)).toBe(IDLE_CLOCK);
    const running = startClock(T0);
    expect(resumeClock(running, T0 + 5)).toBe(running);
    const paused = pauseClock(running, T0 + 5);
    expect(pauseClock(paused, T0 + 50)).toBe(paused);
  });

  it("clamps to the duration and reports time up", () => {
    const c = startClock(T0);
    expect(isTimeUp(c, T0 + 20 * MIN - 1, 20 * MIN)).toBe(false);
    expect(isTimeUp(c, T0 + 20 * MIN, 20 * MIN)).toBe(true);
    expect(elapsedMs(c, T0 + 99 * MIN, 20 * MIN)).toBe(20 * MIN);
    expect(remainingMs(c, T0 + 99 * MIN, 20 * MIN)).toBe(0);
    expect(isTimeUp(IDLE_CLOCK, T0, 20 * MIN)).toBe(false);
  });

  it("never goes negative when the system clock moves backwards", () => {
    const c = startClock(T0);
    expect(elapsedMs(c, T0 - 5 * MIN, 180 * MIN)).toBe(0);
    const paused = pauseClock(startClock(T0), T0 - 1000);
    expect(paused.banked).toBe(0);
  });
});

describe("formatting", () => {
  it("formats with and without hours; remaining time rounds up", () => {
    expect(formatTimer(180 * MIN, { hours: true })).toBe("3:00:00");
    expect(formatTimer(179 * MIN + 59_001, { hours: true, round: "up" })).toBe("3:00:00");
    expect(formatTimer(179 * MIN + 59_001, { hours: true, round: "down" })).toBe("2:59:59");
    expect(formatTimer(25 * MIN + 5000, { hours: false })).toBe("25:05");
    expect(formatTimer(90 * MIN, { hours: false })).toBe("90:00");
    expect(formatTimer(-5, { hours: false })).toBe("00:00");
    expect(formatTimer(1, { hours: false, round: "up" })).toBe("00:01");
  });

  it("speaks durations and labels minutes", () => {
    expect(spokenDuration(2 * 3600_000 + 5 * MIN)).toBe("2 hours 5 minutes");
    expect(spokenDuration(45_000)).toBe("45 seconds");
    expect(spokenDuration(MIN)).toBe("1 minute");
    expect(spokenDuration(0)).toBe("0 seconds");
    expect(minutesLabel(20)).toBe("20 min");
    expect(minutesLabel(90)).toBe("1 h 30 min");
    expect(minutesLabel(180)).toBe("3 h");
    expect(minutesLabel(2.5)).toBe("2.5 min");
  });
});

describe("checkpoints", () => {
  const cps: Checkpoint[] = [
    { id: "b", label: "Second", atMin: 60, targetQuestions: 35 },
    { id: "a", label: "First", atMin: 20, targetQuestions: 10 },
    { id: "blank", label: "No minute yet", atMin: null, targetQuestions: null },
    { id: "late", label: "After the end", atMin: 200, targetQuestions: null },
    { id: "zero", label: "", atMin: 0, targetQuestions: null },
    { id: "unlabelled", label: "  ", atMin: 90, targetQuestions: null },
  ];

  it("explains unusable checkpoints", () => {
    expect(checkpointIssue(cps[0], 180, 65)).toBeNull();
    expect(checkpointIssue(cps[2], 180, 65)).toMatch(/Enter the minute/);
    expect(checkpointIssue(cps[3], 180, 65)).toMatch(/within the 180-minute/);
    expect(checkpointIssue(cps[4], 180, 65)).toMatch(/after the start/);
    expect(checkpointIssue({ id: "t", label: "", atMin: 10, targetQuestions: 70 }, 180, 65)).toMatch(/cannot exceed the 65/);
    expect(checkpointIssue({ id: "t", label: "", atMin: 10, targetQuestions: 2.5 }, 180, 65)).toMatch(/whole number/);
    expect(checkpointIssue({ id: "t", label: "", atMin: 10, targetQuestions: 500 }, 180, null)).toBeNull();
  });

  it("keeps usable checkpoints sorted by time and names unlabelled ones", () => {
    const plan = planCheckpoints(cps, 180, 65);
    expect(plan.map((c) => c.id)).toEqual(["a", "b", "unlabelled"]);
    expect(plan[0].atMs).toBe(20 * MIN);
    expect(plan[2].label).toBe("Checkpoint at 1 h 30 min");
  });

  it("reports the last and next checkpoint", () => {
    const plan = planCheckpoints(cps, 180, 65);
    expect(checkpointProgress(plan, 0)).toMatchObject({ last: null, next: { id: "a" } });
    expect(checkpointProgress(plan, 20 * MIN)).toMatchObject({ last: { id: "a" }, next: { id: "b" } });
    const end = checkpointProgress(plan, 180 * MIN);
    expect(end.passed).toHaveLength(3);
    expect(end.next).toBeNull();
  });

  it("builds quarter checkpoints for subject practice", () => {
    const s = subjectCheckpoints(10, 3);
    expect(s.map((c) => [c.atMin, c.targetQuestions])).toEqual([
      [7.5, 3],
      [15, 5],
      [22.5, 8],
    ]);
    expect(subjectCheckpoints(1, 2)).toEqual([]);
  });
});

describe("pace", () => {
  it("compares with a linear pace", () => {
    // 65 questions in 180 minutes: after 90 minutes a linear pace has done 32.5.
    const p = linearPace(36, 65, 90 * MIN, 180 * MIN)!;
    expect(p.expected).toBeCloseTo(32.5);
    expect(p.state).toBe("ahead");
    expect(p.questions).toBe(3);
    expect(linearPace(30, 65, 90 * MIN, 180 * MIN)).toMatchObject({ state: "behind", questions: 2 });
    expect(linearPace(32, 65, 90 * MIN, 180 * MIN)).toMatchObject({ state: "on-pace", questions: 0 });
    expect(linearPace(0, 65, 0, 180 * MIN)).toMatchObject({ state: "on-pace", expected: 0 });
  });

  it("is unavailable without a question total", () => {
    expect(linearPace(3, null, MIN, 10 * MIN)).toBeNull();
    expect(linearPace(3, 0, MIN, 10 * MIN)).toBeNull();
  });

  it("computes time per question and clamps the counter", () => {
    expect(timePerQuestion(30 * MIN, 10)).toBe(3 * MIN);
    expect(timePerQuestion(30 * MIN, 0)).toBeNull();
    expect(clampDone(-1, 65)).toBe(0);
    expect(clampDone(66, 65)).toBe(65);
    expect(clampDone(1200, null)).toBe(999);
  });
});

describe("alerts", () => {
  const plan = planCheckpoints(DEFAULT_FULL_CHECKPOINTS, FULL_EXAM_MINUTES, 65);
  const schedule = alertSchedule(plan, 180 * MIN);

  it("schedules checkpoints, time-left alerts and the end in order", () => {
    expect(schedule.map((a) => a.key)).toEqual(["cp:ga:1200000", "cp:da-1:3900000", "left:30", "cp:da-2:9300000", "left:10", "cp:review:10500000", "left:5", "left:1", "end"]);
  });

  it("skips time-left alerts that are not shorter than the run", () => {
    const keys = alertSchedule([], 20 * MIN).map((a) => a.key);
    expect(keys).toEqual(["left:10", "left:5", "left:1", "end"]);
    expect(alertSchedule([], 60_000).map((a) => a.key)).toEqual(["end"]);
  });

  it("returns the most recent alert (it changes only when a new one happens)", () => {
    expect(latestAlert(schedule, 19 * MIN)).toBeNull();
    expect(latestAlert(schedule, 20 * MIN)?.key).toBe("cp:ga:1200000");
    expect(latestAlert(schedule, 64 * MIN)?.key).toBe("cp:ga:1200000");
    expect(latestAlert(schedule, 151 * MIN)?.key).toBe("left:30");
    expect(latestAlert(schedule, 180 * MIN)?.kind).toBe("time-up");
  });
});

describe("configuration", () => {
  it("plans the full exam", () => {
    const p = buildPlan(DEFAULT_CONFIG)!;
    expect(p.durationMs).toBe(180 * MIN);
    expect(p.totalQuestions).toBe(65);
    expect(p.checkpoints.map((c) => c.id)).toEqual(["ga", "da-1", "da-2", "review"]);
  });

  it("plans subject practice as questions × minutes per question", () => {
    const cfg: TimerConfig = { ...DEFAULT_CONFIG, mode: "subject", subject: { questions: 12, minutesPerQuestion: 2.5 } };
    const p = buildPlan(cfg)!;
    expect(p.durationMs).toBe(30 * MIN);
    expect(p.totalQuestions).toBe(12);
    expect(p.checkpoints).toHaveLength(3);
  });

  it("plans a custom run with optional questions and checkpoints", () => {
    const cfg: TimerConfig = {
      ...DEFAULT_CONFIG,
      mode: "custom",
      custom: { minutes: 45, questions: null, checkpoints: [{ id: "x", label: "Half", atMin: 22.5, targetQuestions: null }] },
    };
    const p = buildPlan(cfg)!;
    expect(p).toMatchObject({ durationMs: 45 * MIN, totalQuestions: null });
    expect(p.checkpoints[0].atMs).toBe(22.5 * MIN);
  });

  it("rejects invalid settings with a reason", () => {
    expect(configIssue({ ...DEFAULT_CONFIG, mode: "subject", subject: { questions: 0, minutesPerQuestion: 3 } })).toMatch(/whole number of questions/);
    expect(configIssue({ ...DEFAULT_CONFIG, mode: "subject", subject: { questions: 5, minutesPerQuestion: null } })).toMatch(/minutes per question/);
    expect(configIssue({ ...DEFAULT_CONFIG, mode: "custom", custom: { minutes: 0, questions: null, checkpoints: [] } })).toMatch(/duration/);
    expect(configIssue({ ...DEFAULT_CONFIG, mode: "custom", custom: { minutes: 30, questions: 1.5, checkpoints: [] } })).toMatch(/question count/);
    expect(buildPlan({ ...DEFAULT_CONFIG, mode: "custom", custom: { minutes: null, questions: null, checkpoints: [] } })).toBeNull();
  });

  it("parses stored settings defensively", () => {
    expect(parseConfig(null)).toBe(DEFAULT_CONFIG);
    expect(parseConfig("not json")).toBe(DEFAULT_CONFIG);
    expect(parseConfig("[]")).toBe(DEFAULT_CONFIG);
    const cfg = parseConfig(
      JSON.stringify({
        mode: "custom",
        fullCheckpoints: [{ id: "a", label: "A", atMin: 10, targetQuestions: 5 }, { id: "a", label: "dup" }, { nope: 1 }],
        custom: { minutes: 50, questions: "7", checkpoints: "bad" },
      }),
    );
    expect(cfg.mode).toBe("custom");
    expect(cfg.fullCheckpoints).toEqual([{ id: "a", label: "A", atMin: 10, targetQuestions: 5 }]);
    expect(cfg.custom).toEqual({ minutes: 50, questions: null, checkpoints: [] });
    expect(cfg.subject).toEqual(DEFAULT_CONFIG.subject);
  });

  it("parses a stored run and rejects broken ones", () => {
    const run = {
      plan: { mode: "full", durationMs: 180 * MIN, totalQuestions: 65, checkpoints: [{ id: "ga", label: "GA", atMs: 20 * MIN, targetQuestions: 10 }, { id: "bad", label: "x", atMs: 999 * MIN }] },
      clock: { status: "running", segmentStart: T0, banked: 1000 },
      done: 80,
      dismissed: "cp:ga:1200000",
    };
    const parsed = parseRun(JSON.stringify(run))!;
    expect(parsed.plan.checkpoints.map((c) => c.id)).toEqual(["ga"]);
    expect(parsed.done).toBe(65);
    expect(parsed.clock).toEqual({ status: "running", segmentStart: T0, banked: 1000 });
    expect(parseRun(null)).toBeNull();
    expect(parseRun("{")).toBeNull();
    expect(parseRun(JSON.stringify({ ...run, clock: { status: "running", segmentStart: null, banked: 0 } }))).toBeNull();
    expect(parseRun(JSON.stringify({ ...run, clock: { status: "idle" } }))).toBeNull();
    expect(parseRun(JSON.stringify({ ...run, plan: { ...run.plan, durationMs: 0 } }))).toBeNull();
  });
});
