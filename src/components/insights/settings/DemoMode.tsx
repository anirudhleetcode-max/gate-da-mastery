"use client";
/**
 * Demo mode: switch to the separate demo database and fill it with a
 * generated study history built from real question ids. The real database
 * is never read or written by anything here.
 */
import { useState } from "react";
import { FlaskConical, RotateCcw, Sparkles } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { useSetting, useUserData } from "@/lib/userdata/hooks";
import { clearAll } from "@/lib/userdata/ops";
import { createDb, DEMO_DB_NAME } from "@/lib/userdata/db";
import { DEMO_INFO_KEY, generateDemoData, referencedQuestionIds, writeDemoData, type DemoInfo, type DemoMock, type DemoQuestion } from "@/lib/demo/seed";
import type { KeyResponse } from "@/lib/mock/types";
import { plural } from "@/lib/utils";
import { Switch } from "./Switch";

export interface DemoMockOption extends DemoMock {
  title: string;
}

/** Turn a mock answer key (fetched only when the student opts in) into demo question records. */
function fromKey(key: KeyResponse, mock: DemoMockOption): DemoQuestion[] {
  const allowed = new Set(mock.questionIds);
  return key.questions
    .filter((q) => q.origin === "MOCK_TEST" && q.testId === mock.id && allowed.has(q.id))
    .map((q) => ({
      id: q.id,
      origin: "MOCK_TEST" as const,
      subjectId: q.subjectId,
      topicId: q.topicId,
      topicName: q.topicName,
      type: q.type,
      marks: q.marks,
      estimatedTimeSec: q.estimatedTimeSec,
      answer: q.answer,
      title: `Mock ${mock.number} · Q.${q.questionNumber ?? mock.questionIds.indexOf(q.id) + 1}`,
      testId: mock.id,
      questionNumber: q.questionNumber,
    }));
}

type Notice = { tone: "success" | "danger" | "info"; text: string } | null;

/** A fresh seed per generation (called from an event handler, never during render). */
function newSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] & 0x7fffffff;
}

export function DemoMode({ pyqs, mocks }: { pyqs: DemoQuestion[]; mocks: DemoMockOption[] }) {
  const { db, demo, setDemo, available } = useUserData();
  const [info] = useSetting<DemoInfo | null>(DEMO_INFO_KEY, null);
  const [includeMocks, setIncludeMocks] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const mockChoice = mocks.slice(0, 2);

  async function generate() {
    setBusy(true);
    setNotice(null);
    try {
      const questions: DemoQuestion[] = [...pyqs];
      const demoMocks: DemoMock[] = [];
      if (includeMocks) {
        for (const m of mockChoice) {
          const r = await fetch(`/api/mocks/${encodeURIComponent(m.id)}/key`);
          if (!r.ok) continue; // not available any more: simply left out
          const qs = fromKey((await r.json()) as KeyResponse, m);
          if (qs.length !== m.questionIds.length) continue;
          questions.push(...qs);
          demoMocks.push({ id: m.id, number: m.number, durationMinutes: m.durationMinutes, negativeMarking: m.negativeMarking, questionIds: m.questionIds });
        }
      }
      const seed = newSeed();
      const data = generateDemoData({ questions, mocks: demoMocks, seed, now: new Date() });
      // Runtime guard: never write an id that did not come from the server.
      const allowed = new Set(questions.map((q) => q.id));
      for (const id of referencedQuestionIds(data)) if (!allowed.has(id)) throw new Error(`Unexpected question id ${id}; nothing was written.`);

      if (demo && db && db.name === DEMO_DB_NAME) {
        await writeDemoData(db, data);
      } else {
        const demoDb = createDb(DEMO_DB_NAME);
        await demoDb.open();
        try {
          await writeDemoData(demoDb, data);
        } finally {
          demoDb.close();
        }
        setDemo(true);
      }
      setNotice({
        tone: "success",
        text: `Demo data generated: ${plural(data.attempts.length, "attempt")}, ${plural(data.revisionItems.length, "revision item")}, ${plural(data.errorLogs.length, "error-log entry", "error-log entries")}${data.mockAttempts.length ? ` and ${plural(data.mockAttempts.length, "mock attempt")}` : ""}. Demo mode is on; your own data is untouched.`,
      });
    } catch (e) {
      setNotice({ tone: "danger", text: `Demo data could not be generated: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  async function clearDemo() {
    setBusy(true);
    try {
      if (demo && db && db.name === DEMO_DB_NAME) await clearAll(db);
      else {
        const demoDb = createDb(DEMO_DB_NAME);
        await demoDb.delete();
      }
      setNotice({ tone: "success", text: demo ? "The demo database is now empty." : "The demo database was deleted." });
    } catch (e) {
      setNotice({ tone: "danger", text: `Could not clear demo data: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={demo ? "border-warning/50" : undefined}>
      <CardHeader
        title="Demo mode"
        description="Explore the dashboards, analytics and revision tools with a generated study history before you have your own."
        action={
          demo ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-warning-soft px-2 py-1 text-xs font-bold uppercase tracking-wide text-warning">
              <FlaskConical aria-hidden className="h-3.5 w-3.5" /> Demo data active
            </span>
          ) : null
        }
      />
      <CardBody className="space-y-5">
        <Callout tone="info" title="Demo data is kept completely separate">
          Demo mode switches the app to a second database in this browser. Your own progress stays in its own database and is never read, changed or mixed with demo data. Switching back shows your
          data exactly as you left it, and a DEMO DATA banner is shown on every page while demo mode is on.
        </Callout>

        <Switch
          checked={demo}
          onChange={(on) => {
            setNotice(null);
            setDemo(on);
          }}
          disabled={!available || busy}
          label="Use the demo database"
          description={demo ? "On: you are viewing demo data. Turn off to return to your own data." : "Off: you are viewing your own data."}
        />

        <div className="space-y-3 border-t border-border pt-5">
          <h3 className="text-sm font-semibold text-fg">Generate demo data</h3>
          <p className="text-sm text-fg-3">
            Creates about four weeks of fictional practice on real official PYQs ({pyqs.length} available), with correct and incorrect answers, a revision queue, error-log entries and bookmarks. It
            replaces whatever is in the demo database and {demo ? "keeps demo mode on" : "then turns demo mode on"}.
          </p>
          <label className={`flex items-start gap-2.5 text-sm ${mockChoice.length ? "text-fg" : "text-fg-3"}`}>
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--accent)]" checked={includeMocks && mockChoice.length > 0} disabled={!mockChoice.length || busy} onChange={(e) => setIncludeMocks(e.target.checked)} />
            <span>
              Also simulate submitted attempts of {mockChoice.length ? mockChoice.map((m) => `Mock ${m.number}`).join(" and ") : "available mock tests"}
              <span className="block text-fg-3">
                {mockChoice.length
                  ? "Spoiler warning: a submitted demo attempt unlocks that mock's questions and solutions while demo mode is on. Leave this off if you plan to take those mocks for real."
                  : "No mock test is fully verified yet, so demo data uses official PYQs only."}
              </span>
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button variant={demo ? "secondary" : "primary"} onClick={generate} disabled={!available || busy || pyqs.length === 0}>
              <Sparkles aria-hidden className="h-4 w-4" /> {busy ? "Working…" : demo ? "Regenerate demo data" : "Generate demo data and switch to it"}
            </Button>
            <Button variant="ghost" onClick={clearDemo} disabled={!available || busy}>
              <RotateCcw aria-hidden className="h-4 w-4" /> {demo ? "Empty the demo database" : "Delete the demo database"}
            </Button>
          </div>
          {demo && info ? (
            <p className="text-sm text-fg-3">
              Current demo data was generated {new Date(info.generatedAt).toLocaleString()} from {plural(info.pyqs, "PYQ")}
              {info.mocks.length ? ` and ${info.mocks.map((m) => `Mock ${Number(m.slice(5))}`).join(", ")}` : ""}.
            </p>
          ) : null}
        </div>

        <div role="status" aria-live="polite">
          {notice ? <Callout tone={notice.tone}>{notice.text}</Callout> : null}
        </div>
      </CardBody>
    </Card>
  );
}
