"use client";
/**
 * Exam-mode loader: waits for the local database, fetches the paper (without
 * answers), makes sure the mock is not already open in another tab, then
 * resumes the in-progress attempt or creates a new one.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ExamPattern } from "@/lib/content/schema";
import type { MockAttemptRow } from "@/lib/userdata/db";
import { useUserData } from "@/lib/userdata/hooks";
import { startOrResume } from "@/lib/mock/persist";
import type { MockTestDef, PaperQuestion, PaperResponse } from "@/lib/mock/types";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ExamSession } from "./ExamSession";

type Load =
  | { kind: "loading" }
  | { kind: "not_found" }
  | { kind: "unavailable"; loaded: number; planned: number }
  | { kind: "network"; message: string }
  | { kind: "locked" }
  | { kind: "storage"; message: string }
  | { kind: "ready"; test: MockTestDef; questions: PaperQuestion[]; attempt: MockAttemptRow; resumed: boolean };

/** Hold a Web Lock for this mock while the exam is open (null if another tab holds it). */
function acquireLock(name: string): Promise<{ release: () => void } | null> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks) return Promise.resolve({ release: () => {} });
  return new Promise((resolve, reject) => {
    let release: () => void = () => {};
    const held = new Promise<void>((r) => (release = r));
    locks
      .request(name, { ifAvailable: true }, async (lock) => {
        if (!lock) {
          resolve(null);
          return;
        }
        resolve({ release });
        await held;
      })
      .catch(reject);
  });
}

export function ExamRunner({ testId, testTitle, pattern }: { testId: string; testTitle: string; pattern: ExamPattern | null }) {
  const { db, ready, available, demo } = useUserData();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attemptNo, setAttemptNo] = useState(0);

  useEffect(() => {
    if (!ready || !db) return;
    let cancelled = false;
    let lock: { release: () => void } | null = null;
    const ctrl = new AbortController();
    (async () => {
      let paper: PaperResponse;
      try {
        const res = await fetch(`/api/mocks/${encodeURIComponent(testId)}/paper`, { signal: ctrl.signal, cache: "no-store" });
        if (res.status === 404) {
          if (!cancelled) setLoad({ kind: "not_found" });
          return;
        }
        if (!res.ok) throw new Error(`The server answered with status ${res.status}.`);
        paper = (await res.json()) as PaperResponse;
      } catch (e) {
        if (cancelled) return;
        setLoad({ kind: "network", message: e instanceof TypeError ? "The question paper could not be downloaded. Check your connection." : (e as Error).message });
        return;
      }
      if (cancelled) return;
      if (!paper.test.available || paper.questions.length === 0) {
        setLoad({ kind: "unavailable", loaded: paper.questions.length, planned: paper.test.questionIds.length });
        return;
      }
      try {
        lock = await acquireLock(`gate-da-mock:${testId}`);
      } catch {
        lock = { release: () => {} };
      }
      if (cancelled) {
        lock?.release();
        return;
      }
      if (!lock) {
        setLoad({ kind: "locked" });
        return;
      }
      try {
        const { attempt, resumed } = await startOrResume(
          db,
          paper.test,
          paper.questions.map((q) => q.id),
        );
        if (!cancelled) setLoad({ kind: "ready", test: paper.test, questions: paper.questions, attempt, resumed });
      } catch {
        if (!cancelled) setLoad({ kind: "storage", message: "Your attempt could not be created in this browser's storage." });
      }
    })();
    return () => {
      cancelled = true;
      ctrl.abort();
      lock?.release();
    };
  }, [db, ready, testId, attemptNo]);

  const retry = () => {
    setLoad({ kind: "loading" });
    setAttemptNo((n) => n + 1);
  };
  const back = (
    <ButtonLink href={`/mocks/${encodeURIComponent(testId)}`} variant="secondary">
      Back to the mock
    </ButtonLink>
  );

  if (ready && !available) {
    return (
      <Panel title="Your browser is blocking local storage">
        <p>
          Mock attempts are saved on this device (IndexedDB) so that a refresh resumes the test and your results can be analysed. This browser window does not allow that, for example in some private-browsing modes. Open the
          site in a normal window to take this mock.
        </p>
        <div className="mt-5">{back}</div>
      </Panel>
    );
  }

  switch (load.kind) {
    case "loading":
      return (
        <Panel title={testTitle}>
          <p role="status" className="flex items-center gap-2">
            <Loader2 aria-hidden className="h-4 w-4 animate-spin text-accent" /> Loading the question paper…
          </p>
        </Panel>
      );
    case "not_found":
      return (
        <Panel title="Mock test not found">
          <p>There is no mock test with this address.</p>
          <div className="mt-5">
            <ButtonLink href="/mocks" variant="primary">
              All mock tests
            </ButtonLink>
          </div>
        </Panel>
      );
    case "unavailable":
      return (
        <Panel title="This mock is not yet available">
          <p>
            {load.loaded} of {load.planned} questions of this mock are published so far. It can be taken once the full paper is available.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <ButtonLink href="/mocks" variant="primary">
              Choose another mock
            </ButtonLink>
          </div>
        </Panel>
      );
    case "network":
      return (
        <Panel title="The paper could not be loaded">
          <p role="alert">{load.message}</p>
          <p className="mt-2">Any in-progress attempt is saved on this device and will resume when the paper loads.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="primary" onClick={retry}>
              Try again
            </Button>
            {back}
          </div>
        </Panel>
      );
    case "locked":
      return (
        <Panel title="This mock is already open">
          <p>This mock test is open in another tab or window. Continue there, or close it and try again here, so the two copies do not overwrite each other.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="primary" onClick={retry}>
              Try again
            </Button>
            {back}
          </div>
        </Panel>
      );
    case "storage":
      return (
        <Panel title="The attempt could not be started">
          <p role="alert">{load.message} Free up storage or check the browser&apos;s site-data settings, then try again.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="primary" onClick={retry}>
              Try again
            </Button>
            {back}
          </div>
        </Panel>
      );
    case "ready":
      return <ExamSession key={load.attempt.id} db={db!} test={load.test} questions={load.questions} initial={load.attempt} resumed={load.resumed} demo={demo} pattern={pattern} />;
  }
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-lg rounded-[var(--radius)] border border-border bg-surface p-6 text-sm text-fg-2 shadow-[var(--shadow)]">
        <h1 className="mb-2 text-lg font-semibold text-fg">{title}</h1>
        {children}
        <p className="mt-6 border-t border-border pt-3 text-xs text-fg-3">
          <Link href="/mocks" className="hover:underline">
            Mock tests
          </Link>{" "}
          · original questions written for this platform (not official GATE questions)
        </p>
      </div>
    </main>
  );
}
