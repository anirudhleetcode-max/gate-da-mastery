"use client";
/**
 * Raw JSON editor for one content file. Loads and saves through
 * /api/admin/file, which validates with the content schemas before writing.
 */
import Link from "next/link";
import { Fragment, useEffect, useId, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, Lock, RefreshCw, Save, ShieldCheck, TriangleAlert } from "lucide-react";
import type { FileKindInfo } from "./validateFile";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

interface Issue {
  level: "error" | "warning";
  entity: string;
  message: string;
}

interface Loaded {
  info: FileKindInfo;
  sha256: string;
  original: string;
  modifiedAt: string;
}

type LoadState = { status: "loading" } | { status: "error"; message: string } | ({ status: "ready" } & Loaded);

type Outcome =
  | { kind: "valid"; issues: Issue[]; records?: number }
  | { kind: "saved"; issues: Issue[]; reminders: string[]; unchanged: boolean }
  | { kind: "invalid"; issues: Issue[]; message: string }
  | { kind: "conflict"; message: string }
  | { kind: "error"; message: string; needsReason?: boolean };

async function fetchFile(file: string): Promise<LoadState> {
  try {
    const r = await fetch(`/api/admin/file?path=${encodeURIComponent(file)}`, { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { status: "error", message: typeof d.error === "string" ? d.error : `The file could not be loaded (HTTP ${r.status}).` };
    return { status: "ready", info: d.info, sha256: d.sha256, original: d.content, modifiedAt: d.modifiedAt };
  } catch {
    return { status: "error", message: "The server could not be reached." };
  }
}

/** Render `code` spans in reminder text. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split("`").map((part, i) =>
        i % 2 ? (
          <code key={i} className="break-all rounded bg-surface-2 px-1 font-mono text-[0.8rem]">
            {part}
          </code>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

export function FileEditor({ file }: { file: string }) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [text, setText] = useState<string | null>(null);
  const [freezeReason, setFreezeReason] = useState("");
  const [busy, setBusy] = useState<null | "validate" | "save" | "reload">(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const ids = { editor: useId(), help: useId(), reason: useId(), status: useId() };

  useEffect(() => {
    let cancelled = false;
    fetchFile(file).then((s) => {
      if (cancelled) return;
      setLoad(s);
      if (s.status === "ready") setText(s.original);
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

  const ready = load.status === "ready" ? load : null;
  const value = text ?? "";
  const dirty = ready !== null && text !== null && text !== ready.original;

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  async function reload() {
    setBusy("reload");
    const s = await fetchFile(file);
    setLoad(s);
    if (s.status === "ready") setText(s.original);
    setOutcome(null);
    setBusy(null);
  }

  async function put(dryRun: boolean, force: boolean) {
    const r = await fetch("/api/admin/file", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: file, content: text, baseSha256: ready?.sha256, freezeReason: ready?.info.frozen ? freezeReason : undefined, dryRun, force }),
    });
    const d = await r.json().catch(() => ({}));
    return { r, d, issues: (Array.isArray(d.issues) ? d.issues : []) as Issue[] };
  }

  async function submit(mode: "validate" | "save", force = false) {
    if (!ready || text === null) return;
    setOutcome(null);
    if (mode === "save" && ready.info.frozen && !freezeReason.trim()) {
      setOutcome({ kind: "error", needsReason: true, message: "Official PYQ files are frozen. Give a freeze reason (what was wrong and how it was checked against the official paper) to save this change." });
      reasonRef.current?.focus();
      return;
    }
    setBusy(mode);
    try {
      // Always validate first (a dry run never writes), so an invalid file is reported without a failed write request.
      const check = await put(true, false);
      if (!check.r.ok) {
        setOutcome({ kind: "error", message: check.d.error ?? `The request failed (HTTP ${check.r.status}).` });
        return;
      }
      if (!check.d.ok) {
        setOutcome({ kind: "invalid", issues: check.issues, message: check.d.error ?? "Validation failed." });
        return;
      }
      if (mode === "validate") {
        setOutcome({ kind: "valid", issues: check.issues, records: check.d.records });
        return;
      }
      const { r, d, issues } = await put(false, force);
      if (r.status === 422) setOutcome({ kind: "invalid", issues, message: d.error ?? "Validation failed." });
      else if (r.status === 409 && d.conflict) setOutcome({ kind: "conflict", message: d.error });
      else if (r.status === 409 && d.requiresFreezeReason) {
        setOutcome({ kind: "error", message: d.error, needsReason: true });
        reasonRef.current?.focus();
      } else if (!r.ok) setOutcome({ kind: "error", message: d.error ?? `The request failed (HTTP ${r.status}).` });
      else {
        const saved = text.endsWith("\n") ? text : `${text}\n`;
        setLoad({ ...ready, status: "ready", sha256: d.sha256, modifiedAt: new Date().toISOString(), original: saved });
        setText(saved);
        setOutcome({ kind: "saved", issues, reminders: Array.isArray(d.reminders) ? d.reminders : [], unchanged: Boolean(d.unchanged) });
      }
    } catch {
      setOutcome({ kind: "error", message: "The server could not be reached. Nothing was written." });
    } finally {
      setBusy(null);
    }
  }

  function goTo(line: number, column: number) {
    const el = area.current;
    if (!el) return;
    const lines = value.split("\n");
    let pos = 0;
    for (let i = 0; i < Math.min(line - 1, lines.length); i++) pos += lines[i].length + 1;
    pos += Math.max(0, column - 1);
    el.focus();
    el.setSelectionRange(pos, pos + 1);
    // Bring the caret into view (approximate: line height 20px).
    el.scrollTop = Math.max(0, (line - 5) * 20);
  }

  if (load.status === "loading") {
    return (
      <p role="status" className="text-sm text-fg-3">
        Loading {file}…
      </p>
    );
  }
  if (load.status === "error") {
    return (
      <Callout tone="danger" title="The file could not be opened">
        {load.message}{" "}
        <Link href="/admin/edit" className="underline">
          Back to the file list
        </Link>
      </Callout>
    );
  }

  const info = load.info;
  const lines = value.split("\n").length;
  const kb = Math.max(1, Math.round(new Blob([value]).size / 1024));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone="outline">{info.label}</Badge>
        {info.writable ? null : (
          <Badge tone="neutral">
            <Lock aria-hidden className="h-3 w-3" /> Read-only
          </Badge>
        )}
        {dirty ? <Badge tone="warning">Unsaved changes</Badge> : <Badge tone="success">No unsaved changes</Badge>}
        <span className="tnum text-fg-3">
          {lines} lines · {kb} KB · last modified {new Date(load.modifiedAt).toLocaleString()}
        </span>
      </div>

      {info.frozen ? (
        <Callout tone="warning" title="Official PYQ: frozen file">
          Official questions must match the official paper and answer key exactly. Saving requires a freeze reason, and afterwards you must run{" "}
          <code className="font-mono">npm run content:freeze-pyqs -- --reason &quot;…&quot;</code> so the change is recorded in the PYQ freeze log.
        </Callout>
      ) : null}
      {!info.writable && info.readOnlyReason ? (
        <Callout tone="info" title="This file is read-only here">
          <Inline text={info.readOnlyReason} />
        </Callout>
      ) : null}

      <div>
        <label htmlFor={ids.editor} className="mb-1 block text-sm font-medium text-fg">
          JSON content
        </label>
        <p id={ids.help} className="mb-2 text-xs text-fg-3">
          {info.writable ? "Validate checks JSON syntax, the content schema for this path and the semantic rules without writing. Save validates again, then writes atomically. Ctrl/⌘ + S saves." : "You can edit and validate here, but saving is disabled for this file."}
        </p>
        <textarea
          ref={area}
          id={ids.editor}
          aria-describedby={ids.help}
          value={value}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
              e.preventDefault();
              if (info.writable && busy === null) void submit("save");
            }
          }}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          wrap="off"
          className="block h-[62vh] min-h-72 w-full resize-y rounded-lg border border-border bg-surface p-3 font-mono text-[0.8rem] leading-5 text-fg"
        />
      </div>

      {info.frozen && info.writable ? (
        <div>
          <label htmlFor={ids.reason} className="mb-1 block text-sm font-medium text-fg">
            Freeze reason <span className="font-normal text-fg-3">(required to save an official PYQ)</span>
          </label>
          <textarea
            ref={reasonRef}
            id={ids.reason}
            value={freezeReason}
            onChange={(e) => setFreezeReason(e.target.value)}
            rows={2}
            placeholder="What was wrong, and how the fix was checked against the official paper and key"
            className="block w-full rounded-lg border border-border bg-surface p-2.5 text-sm text-fg placeholder:text-fg-3"
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => submit("validate")} disabled={busy !== null}>
          <ShieldCheck aria-hidden className="h-4 w-4" /> {busy === "validate" ? "Validating…" : "Validate"}
        </Button>
        <Button variant="primary" onClick={() => submit("save")} disabled={busy !== null || !info.writable || !dirty} title={!info.writable ? "This file is read-only here" : !dirty ? "No changes to save" : undefined}>
          <Save aria-hidden className="h-4 w-4" /> {busy === "save" ? "Saving…" : "Save"}
        </Button>
        <Button variant="ghost" onClick={reload} disabled={busy !== null}>
          <RefreshCw aria-hidden className="h-4 w-4" /> {dirty ? "Discard changes and reload" : "Reload from disk"}
        </Button>
        <Link
          href="/admin/edit"
          onClick={(e) => {
            if (dirty && !window.confirm("Leave this file? Your unsaved changes will be lost.")) e.preventDefault();
          }}
          className="ml-auto text-sm font-medium text-accent-text hover:underline"
        >
          All content files
        </Link>
      </div>

      <div id={ids.status} role="status" aria-live="polite">
        {outcome ? <OutcomeView outcome={outcome} onGoTo={goTo} onOverwrite={() => submit("save", true)} onReload={reload} /> : null}
      </div>
    </div>
  );
}

function IssueList({ issues, onGoTo }: { issues: Issue[]; onGoTo: (line: number, column: number) => void }) {
  if (!issues.length) return null;
  return (
    <ul className="mt-2 max-h-96 space-y-1 overflow-y-auto">
      {issues.map((i, k) => {
        const pos = i.message.match(/line (\d+), column (\d+)/);
        return (
          <li key={k} className="flex gap-2 text-sm">
            {i.level === "error" ? <CircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-danger" /> : <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" />}
            <span className="min-w-0">
              <span className={cn("font-semibold", i.level === "error" ? "text-danger" : "text-warning")}>{i.level === "error" ? "Error" : "Warning"}</span>{" "}
              <code className="break-all font-mono text-xs text-fg-2">{i.entity}</code> <span className="text-fg">{i.message}</span>
              {pos ? (
                <button type="button" onClick={() => onGoTo(Number(pos[1]), Number(pos[2]))} className="ml-2 text-xs font-medium text-accent-text underline">
                  Go to line {pos[1]}
                </button>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function OutcomeView({ outcome, onGoTo, onOverwrite, onReload }: { outcome: Outcome; onGoTo: (l: number, c: number) => void; onOverwrite: () => void; onReload: () => void }) {
  switch (outcome.kind) {
    case "valid": {
      const warnings = outcome.issues.filter((i) => i.level === "warning").length;
      return (
        <Callout tone="success" title={`Valid${outcome.records !== undefined ? `: ${outcome.records} record${outcome.records === 1 ? "" : "s"} checked` : ""}${warnings ? `, ${warnings} warning${warnings === 1 ? "" : "s"}` : ""}`}>
          Nothing was written. Save to write the file.
          <IssueList issues={outcome.issues} onGoTo={onGoTo} />
        </Callout>
      );
    }
    case "saved":
      return (
        <Callout tone="success" title={outcome.unchanged ? "Saved (the content was identical to the file on disk)" : "Saved"}>
          <p className="flex items-center gap-1.5">
            <CheckCircle2 aria-hidden className="h-4 w-4 text-success" /> The file was validated and written atomically. Next steps:
          </p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            {outcome.reminders.map((r) => (
              <li key={r}>
                <Inline text={r} />
              </li>
            ))}
          </ol>
          <IssueList issues={outcome.issues} onGoTo={onGoTo} />
        </Callout>
      );
    case "invalid":
      return (
        <Callout tone="danger" title={outcome.message}>
          <IssueList issues={outcome.issues} onGoTo={onGoTo} />
        </Callout>
      );
    case "conflict":
      return (
        <Callout tone="warning" title="The file changed on disk">
          <p>{outcome.message}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={onReload}>
              Reload (discard my edits)
            </Button>
            <Button size="sm" variant="danger" onClick={onOverwrite}>
              Save anyway (overwrite)
            </Button>
          </div>
        </Callout>
      );
    case "error":
      return <Callout tone="danger" title={outcome.needsReason ? "Freeze reason required" : "Not saved"}>{outcome.message}</Callout>;
  }
}
