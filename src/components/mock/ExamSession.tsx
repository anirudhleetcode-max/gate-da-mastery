"use client";
/**
 * Full-screen, CBT-like exam interface for one mock attempt.
 *
 * State lives in a reducer (src/lib/mock/session.ts) and is saved to
 * IndexedDB about once a second, when the tab is hidden and when the page is
 * left, so a refresh resumes exactly. The countdown runs only while this page
 * is open. On submission the attempt is locked, the answer key is fetched and
 * the attempt is scored and recorded (src/lib/mock/persist.ts).
 */
import { useCallback, useEffect, useEffectEvent, useMemo, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Sheet from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Eraser, Flag, LayoutGrid, LogOut, Loader2, X } from "lucide-react";
import type { ExamPattern } from "@/lib/content/schema";
import type { GateDaDB, MockAttemptRow } from "@/lib/userdata/db";
import type { UserResponse } from "@/lib/scoring/score";
import { examReducer, sectionStarts, type ExamAction, type ExamState } from "@/lib/mock/session";
import { answeredCount, paletteCounts, paletteState, PALETTE_LABEL } from "@/lib/mock/palette";
import { finalizeAttempt, saveProgress, saveSubmission } from "@/lib/mock/persist";
import { negativeHint } from "@/lib/mock/structure";
import { CONFIDENCE_LABEL, type Confidence, type KeyResponse, type MockTestDef, type PaperQuestion } from "@/lib/mock/types";
import { TYPE_HELP } from "@/lib/labels";
import { formatClock, cn } from "@/lib/utils";
import { AnswerInput } from "@/components/question/AnswerInput";
import { TypeBadge } from "@/components/question/badges";
import { RichHtml } from "@/components/ui/RichHtml";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import { ExamTimer } from "./ExamTimer";
import { QuestionPalette } from "./QuestionPalette";
import { SubmitDialog } from "./SubmitDialog";
import { PaletteGlyph } from "./PaletteGlyph";
import { MockLabel } from "./MockLabel";

type Phase = "running" | "exiting" | "submitting" | "error";
type Failure = { kind: "save" | "score" | "conflict" | "exit"; message: string };

const SECTION_NAME = { GA: "General Aptitude", DA: "Data Science & AI" } as const;
const TICK_MS = 500;
const SAVE_MS = 1000;

export interface ExamSessionProps {
  db: GateDaDB;
  test: MockTestDef;
  questions: PaperQuestion[];
  initial: MockAttemptRow;
  resumed: boolean;
  demo: boolean;
  pattern: ExamPattern | null;
}

export function ExamSession({ db, test, questions, initial, resumed, demo, pattern }: ExamSessionProps) {
  const router = useRouter();
  const order = useMemo(() => questions.map((q) => q.id), [questions]);
  const [state, dispatch] = useReducer(examReducer, undefined, (): ExamState => ({ attempt: initial, order }));
  const [phase, setPhase] = useState<Phase>("running");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [endedBy, setEndedBy] = useState<"manual" | "timeout" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [saveWarning, setSaveWarning] = useState(false);
  const [showResumeNote, setShowResumeNote] = useState(resumed);

  const attempt = state.attempt;
  const index = attempt.currentIndex;
  const q = questions[index];
  const qs = attempt.questions[q.id];
  const total = questions.length;
  const isLast = index === total - 1;

  // ------------------------------------------------------------ sections
  const sections = useMemo(() => sectionStarts(questions.map((x) => x.section)), [questions]);
  const multiSection = sections.length > 1;
  const currentSection = sections.find((s) => index >= s.start && index <= s.end) ?? sections[0];
  const paletteIndices = useMemo(() => {
    const s = multiSection ? currentSection : { start: 0, end: total - 1 };
    return Array.from({ length: s.end - s.start + 1 }, (_, k) => s.start + k);
  }, [multiSection, currentSection, total]);

  const counts = useMemo(() => paletteCounts(order, attempt.questions), [order, attempt.questions]);
  const answered = answeredCount(counts);
  const sectionCounts = useMemo(
    () =>
      multiSection
        ? sections.map((s) => {
            const ids = order.slice(s.start, s.end + 1);
            return { label: s.section, total: ids.length, counts: paletteCounts(ids, attempt.questions) };
          })
        : undefined,
    [multiSection, sections, order, attempt.questions],
  );

  // ------------------------------------------------------------ persistence (throttled ~1 s)
  const latest = useRef(attempt);
  const dirty = useRef(false);
  const stopped = useRef(false);
  useEffect(() => {
    latest.current = attempt;
    dirty.current = true;
  }, [attempt]);

  const flush = useCallback(async () => {
    if (stopped.current || !dirty.current) return;
    dirty.current = false;
    try {
      const r = await saveProgress(db, latest.current);
      if (r === "saved") {
        setSaveWarning(false);
        return;
      }
      stopped.current = true;
      setPhase("error");
      setFailure({
        kind: "conflict",
        message:
          r === "submitted"
            ? "This attempt was submitted in another tab or window, so it can no longer be changed here."
            : "This attempt was discarded in another tab or window.",
      });
    } catch {
      dirty.current = true;
      setSaveWarning(true);
    }
  }, [db]);

  useEffect(() => {
    const id = window.setInterval(() => void flush(), SAVE_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    const onPageHide = () => void flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      void flush();
    };
  }, [flush]);

  // ------------------------------------------------------------ submission
  const submitting = useRef(false);

  async function scoreAndOpenResults(attemptId: string) {
    setPhase("submitting");
    setFailure(null);
    try {
      const res = await fetch(`/api/mocks/${encodeURIComponent(test.id)}/key`, { cache: "no-store" });
      if (!res.ok) throw new Error(res.status === 404 ? "The answer key for this mock was not found on the server." : `The server answered with status ${res.status}.`);
      const key = (await res.json()) as KeyResponse;
      await finalizeAttempt(db, attemptId, key);
      router.replace(`/mocks/${encodeURIComponent(test.id)}/results/${encodeURIComponent(attemptId)}`);
    } catch (e) {
      setPhase("error");
      setFailure({ kind: "score", message: e instanceof TypeError ? "The server could not be reached. Check your connection." : (e as Error).message });
    }
  }

  async function submit(reason: "manual" | "timeout", snapshot?: MockAttemptRow) {
    if (submitting.current) return;
    submitting.current = true;
    stopped.current = true;
    setConfirmOpen(false);
    setExitOpen(false);
    setPaletteOpen(false);
    setEndedBy(reason);
    setPhase("submitting");
    let saved: MockAttemptRow;
    try {
      saved = await saveSubmission(db, snapshot ?? latest.current);
    } catch {
      submitting.current = false;
      setPhase("error");
      setFailure({ kind: "save", message: "Your submission could not be saved on this device (browser storage refused the write). Your answers are still on this page." });
      return;
    }
    await scoreAndOpenResults(saved.id);
  }

  async function saveAndExit() {
    stopped.current = true;
    setExitOpen(false);
    setPhase("exiting");
    let r: Awaited<ReturnType<typeof saveProgress>>;
    try {
      r = await saveProgress(db, latest.current);
    } catch {
      // Could not save: stay in the test (timer running) and say so.
      stopped.current = false;
      dirty.current = true;
      setPhase("running");
      setFailure({ kind: "exit", message: "Your progress could not be saved, so the test was not closed. Try again, or keep working." });
      return;
    }
    if (r === "saved") {
      router.push(`/mocks/${encodeURIComponent(test.id)}`);
      return;
    }
    setPhase("error");
    setFailure({
      kind: "conflict",
      message: r === "submitted" ? "This attempt was submitted in another tab or window, so it can no longer be changed here." : "This attempt was discarded in another tab or window.",
    });
  }

  // ------------------------------------------------------------ timer
  const onTick = useEffectEvent((deltaMs: number) => {
    const action: ExamAction = { type: "tick", deltaMs, visible: document.visibilityState === "visible" };
    const next = examReducer(state, action);
    dispatch(action);
    if (next.attempt.remainingMs <= 0) void submit("timeout", next.attempt);
  });

  useEffect(() => {
    if (phase !== "running") return;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const delta = now - last;
      last = now;
      onTick(delta);
    };
    const id = window.setInterval(tick, TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [phase]);

  // ------------------------------------------------------------ leaving the page
  useEffect(() => {
    if (phase !== "running") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [phase]);

  // ------------------------------------------------------------ keyboard: ←/→ between questions
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (phase !== "running" || confirmOpen || exitOpen || paletteOpen) return;
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const t = e.target instanceof Element ? e.target : null;
    if (t?.closest("input, textarea, select, [contenteditable='true'], [role='radio'], [role='radiogroup'], [data-palette]")) return;
    e.preventDefault();
    dispatch({ type: e.key === "ArrowRight" ? "next" : "previous" });
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // New question → scroll the question panel back to the top.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [index]);

  const act = (a: ExamAction) => {
    if (phase !== "running") return;
    dispatch(a);
    setShowResumeNote(false);
    if (failure?.kind === "exit") setFailure(null);
  };
  const selectFromPalette = (i: number) => {
    act({ type: "goto", index: i });
    setPaletteOpen(false);
  };

  // ------------------------------------------------------------ non-running screens
  if (phase === "submitting" || phase === "exiting") {
    return (
      <CenterPanel>
        <div role="status" className="flex flex-col items-center gap-3 text-center">
          <Loader2 aria-hidden className="h-6 w-6 animate-spin text-accent" />
          <p className="text-lg font-semibold text-fg">
            {phase === "exiting" ? "Saving your progress…" : endedBy === "timeout" ? "Time is up. Submitting your answers…" : "Submitting and scoring your answers…"}
          </p>
          <p className="text-sm text-fg-3">Please keep this page open.</p>
        </div>
      </CenterPanel>
    );
  }

  if (phase === "error" && failure && failure.kind !== "exit") {
    return (
      <CenterPanel>
        <h1 className="text-lg font-semibold text-fg">
          {failure.kind === "score" ? "Submitted — scoring is waiting for the answer key" : failure.kind === "save" ? "The submission could not be saved" : "This attempt changed elsewhere"}
        </h1>
        <p role="alert" className="mt-2 text-sm text-fg-2">
          {failure.message}
        </p>
        {failure.kind === "score" ? (
          <p className="mt-2 text-sm text-fg-2">
            Your answers are locked and saved on this device, so nothing is lost. Scoring needs the answer key from the server. Retry now, or open the results page later: it finishes scoring automatically.
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          {failure.kind === "score" ? (
            <>
              <Button variant="primary" onClick={() => void scoreAndOpenResults(attempt.id)}>
                Retry scoring
              </Button>
              <Button onClick={() => router.push(`/mocks/${encodeURIComponent(test.id)}`)}>Back to the mock</Button>
            </>
          ) : failure.kind === "save" ? (
            <Button variant="primary" onClick={() => void submit(endedBy ?? "manual")}>
              Try submitting again
            </Button>
          ) : (
            <Button variant="primary" onClick={() => router.push(`/mocks/${encodeURIComponent(test.id)}`)}>
              Back to the mock
            </Button>
          )}
        </div>
      </CenterPanel>
    );
  }

  // ------------------------------------------------------------ exam UI
  const currentState = paletteState(qs);
  const paletteTitle = multiSection ? `Question palette: ${SECTION_NAME[currentSection.section]}` : "Question palette";

  return (
    <div className="flex h-dvh flex-col bg-bg">
      {/* ---------------------------------------------------- top bar */}
      <header className="shrink-0 border-b border-border bg-surface">
        <div className="flex h-14 items-center gap-2 px-2 sm:gap-3 sm:px-4">
          <Button variant="ghost" size="sm" className="h-10 w-10 shrink-0 px-0 sm:w-auto sm:px-3" onClick={() => setExitOpen(true)} aria-label="Save and exit" title="Save and exit (timer pauses)">
            <LogOut aria-hidden className="h-4 w-4" />
            <span className="hidden sm:inline">Exit</span>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold text-fg sm:text-base">
              Mock {test.number}
              <span className="hidden font-normal text-fg-2 md:inline"> · {test.title.replace(/^Mock\s+\d+\s*:\s*/i, "")}</span>
            </h1>
            <p className="truncate text-xs text-fg-3">
              <span className="tnum">{answered}</span> of <span className="tnum">{total}</span> answered · <span className="tnum">{total - answered}</span> remaining
              {demo ? <Badge tone="warning" className="ml-2">DEMO DATA</Badge> : null}
            </p>
          </div>
          <ExamTimer remainingMs={attempt.remainingMs} durationMs={attempt.durationMs} />
          <Button variant="primary" className="h-10 shrink-0 px-3 sm:px-4" onClick={() => setConfirmOpen(true)}>
            Submit
          </Button>
        </div>
        <div className="flex min-h-11 items-center gap-2 border-t border-border px-2 sm:px-4">
          {multiSection ? (
            <nav aria-label="Sections" className="flex min-w-0 gap-1 overflow-x-auto">
              {sections.map((s) => {
                const active = s === currentSection;
                const c = sectionCounts?.find((x) => x.label === s.section);
                return (
                  <button
                    key={s.section}
                    type="button"
                    aria-current={active ? "true" : undefined}
                    onClick={() => act({ type: "goto", index: s.start })}
                    className={cn(
                      "-mb-px flex h-11 items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 text-sm font-medium",
                      active ? "border-accent text-fg" : "border-transparent text-fg-3 hover:text-fg",
                    )}
                  >
                    <span className="sm:hidden">{s.section}</span>
                    <span className="hidden sm:inline">
                      {SECTION_NAME[s.section]} ({s.section})
                    </span>
                    <span className="tnum text-xs text-fg-3">
                      Q{s.start + 1}–{s.end + 1}
                      {c ? ` · ${answeredCount(c.counts)}/${c.total}` : ""}
                    </span>
                  </button>
                );
              })}
            </nav>
          ) : (
            <p className="truncate text-sm text-fg-3">
              {test.negativeMarking ? "GATE marking: wrong MCQ −1/3 or −2/3; no negative marking for MSQ and NAT" : "No negative marking in this mock"}
            </p>
          )}
          <Button size="sm" className="ml-auto h-9 shrink-0 lg:hidden" onClick={() => setPaletteOpen(true)} aria-haspopup="dialog">
            <LayoutGrid aria-hidden className="h-4 w-4" /> Palette
          </Button>
        </div>
        {saveWarning ? (
          <p role="alert" className="border-t border-warning/30 bg-warning-soft px-4 py-1.5 text-sm text-fg">
            Progress could not be saved to this device just now. Keep this page open; saving is retried every second.
          </p>
        ) : null}
        {failure?.kind === "exit" ? (
          <p role="alert" className="border-t border-danger/30 bg-danger-soft px-4 py-1.5 text-sm text-fg">
            {failure.message}
          </p>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ---------------------------------------------------- question */}
        <main className="flex min-w-0 flex-1 flex-col" aria-labelledby="exam-q-heading">
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6">
              {showResumeNote ? (
                <p role="status" className="mb-4 rounded-lg border border-info/30 bg-info-soft px-3 py-2 text-sm text-fg">
                  Resumed where you left off, with {formatClock(initial.remainingMs)} remaining.
                </p>
              ) : null}
              <MockLabel compact className="mb-4" />
              <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border pb-3">
                <h2 id="exam-q-heading" className="text-lg font-semibold text-fg">
                  Question {index + 1}
                  <span className="font-normal text-fg-3"> of {total}</span>
                </h2>
                <TypeBadge type={q.type} marks={q.marks} />
                <span className="text-xs text-fg-3">{negativeHint(q.type, q.marks, test.negativeMarking, pattern)}</span>
                <span className="ml-auto flex items-center gap-1.5 text-xs text-fg-3">
                  <PaletteGlyph state={currentState} size="sm" />
                  {PALETTE_LABEL[currentState]}
                </span>
              </div>
              <p className="sr-only" aria-live="polite" aria-atomic="true">
                {`Question ${index + 1} of ${total}, ${q.type}, ${q.marks} ${q.marks === 1 ? "mark" : "marks"}.`}
              </p>

              <RichHtml html={q.stem} className="text-[1.02rem]" />
              <p className="mt-4 text-xs text-fg-3">{TYPE_HELP[q.type]}</p>
              <div className="mt-3">
                <AnswerInput
                  questionId={q.id}
                  type={q.type}
                  options={q.options}
                  value={qs?.response ?? null}
                  onChange={(r: UserResponse | null) => act({ type: "respond", id: q.id, response: r })}
                />
              </div>

              <ConfidencePicker value={qs?.confidence} onChange={(v) => act({ type: "confidence", id: q.id, value: v })} />

              {isLast ? (
                <p className="mt-5 text-sm text-fg-3">
                  This is the last question. Use the palette to revisit questions, or submit when you are done.
                </p>
              ) : null}
            </div>
          </div>

          {/* ---------------------------------------------------- actions */}
          <nav aria-label="Question actions" className="shrink-0 border-t border-border bg-surface px-2 py-2 sm:px-4">
            <div className="mx-auto grid max-w-5xl grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <Button className="h-11 px-2 sm:px-4" onClick={() => act({ type: "markAndNext" })}>
                <Flag aria-hidden className="h-4 w-4 shrink-0" />
                <span className="truncate">Mark for review &amp; next</span>
              </Button>
              <Button className="h-11 px-2 sm:px-4" onClick={() => act({ type: "clear" })} disabled={!qs?.response && !qs?.confidence}>
                <Eraser aria-hidden className="h-4 w-4 shrink-0" />
                Clear response
              </Button>
              <Button className="h-11 px-2 sm:ml-auto sm:px-4" onClick={() => act({ type: "previous" })} disabled={index === 0}>
                <ChevronLeft aria-hidden className="h-4 w-4 shrink-0" />
                Previous
              </Button>
              <Button variant="primary" className="h-11 px-2 sm:px-5" onClick={() => act({ type: "saveAndNext" })}>
                Save &amp; next
                <ChevronRight aria-hidden className="h-4 w-4 shrink-0" />
              </Button>
            </div>
          </nav>
        </main>

        {/* ---------------------------------------------------- palette (desktop) */}
        <aside aria-label="Question palette" className="hidden w-[19.5rem] shrink-0 overflow-y-auto border-l border-border bg-surface px-5 py-4 lg:block">
          <h2 className="mb-3 text-sm font-semibold text-fg">{paletteTitle}</h2>
          <QuestionPalette order={order} indices={paletteIndices} questions={attempt.questions} currentIndex={index} onSelect={selectFromPalette} title={paletteTitle} />
          <p className="mt-5 text-xs leading-relaxed text-fg-3">Keys: ← / → previous / next question (outside answer fields). In the palette, arrow keys move between questions.</p>
        </aside>
      </div>

      {/* ---------------------------------------------------- palette (mobile sheet) */}
      <Sheet.Root open={paletteOpen} onOpenChange={setPaletteOpen}>
        <Sheet.Portal>
          <Sheet.Overlay className="fixed inset-0 z-50 bg-black/40 lg:hidden" />
          <Sheet.Content className="fixed inset-y-0 right-0 z-50 flex w-[min(22rem,92vw)] flex-col border-l border-border bg-surface shadow-xl lg:hidden">
            <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
              <Sheet.Title className="text-base font-semibold text-fg">{paletteTitle}</Sheet.Title>
              <Sheet.Close className="grid h-10 w-10 place-items-center rounded-md text-fg-3 hover:bg-surface-2 hover:text-fg" aria-label="Close palette">
                <X aria-hidden className="h-5 w-5" />
              </Sheet.Close>
            </div>
            <Sheet.Description className="sr-only">Choose a question to open it. Arrow keys move between questions.</Sheet.Description>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {multiSection ? (
                <nav aria-label="Sections" className="mb-4 flex gap-2">
                  {sections.map((s) => (
                    <Button key={s.section} size="sm" variant={s === currentSection ? "primary" : "secondary"} aria-current={s === currentSection ? "true" : undefined} onClick={() => act({ type: "goto", index: s.start })}>
                      {s.section} · Q{s.start + 1}–{s.end + 1}
                    </Button>
                  ))}
                </nav>
              ) : null}
              <QuestionPalette order={order} indices={paletteIndices} questions={attempt.questions} currentIndex={index} onSelect={selectFromPalette} title={paletteTitle} />
            </div>
          </Sheet.Content>
        </Sheet.Portal>
      </Sheet.Root>

      <SubmitDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => void submit("manual")}
        total={total}
        counts={counts}
        sections={sectionCounts}
        remainingMs={attempt.remainingMs}
      />

      <Dialog
        open={exitOpen}
        onOpenChange={setExitOpen}
        title="Save and exit?"
        description={`Your answers and the remaining time (${formatClock(attempt.remainingMs)}) are saved on this device. The timer pauses until you resume this mock from its page.`}
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={() => setExitOpen(false)}>Continue the test</Button>
          <Button variant="primary" onClick={() => void saveAndExit()}>
            Save and exit
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function ConfidencePicker({ value, onChange }: { value: Confidence | undefined; onChange: (v: Confidence | undefined) => void }) {
  return (
    <div role="group" aria-labelledby="exam-confidence-label" className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4 text-sm">
      <span id="exam-confidence-label" className="text-fg-3">
        Confidence (optional):
      </span>
      {(["high", "medium", "low"] as const).map((c) => (
        <button
          key={c}
          type="button"
          aria-pressed={value === c}
          onClick={() => onChange(value === c ? undefined : c)}
          className={cn(
            "h-9 rounded-md border px-3 font-medium",
            value === c ? "border-accent bg-accent-soft text-accent-text" : "border-border text-fg-2 hover:bg-surface-2",
          )}
        >
          {CONFIDENCE_LABEL[c]}
        </button>
      ))}
      <span className="basis-full text-xs text-fg-3 sm:basis-auto">Used only in your results analysis.</span>
    </div>
  );
}

function CenterPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-lg rounded-[var(--radius)] border border-border bg-surface p-6 shadow-[var(--shadow)]">{children}</div>
    </div>
  );
}
