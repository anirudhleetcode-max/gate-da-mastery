"use client";
/**
 * Backup (export / import), reset and storage information for the ACTIVE
 * database: the student's own data, or the demo database while demo mode is on.
 */
import { useId, useRef, useState } from "react";
import { Database, Download, HardDrive, ShieldCheck, Trash2, Upload } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Callout } from "@/components/ui/Callout";
import { Dialog } from "@/components/ui/Dialog";
import { useDbQuery, useUserData } from "@/lib/userdata/hooks";
import { clearAll, exportAll, importAll } from "@/lib/userdata/ops";
import type { GateDaDB } from "@/lib/userdata/db";
import { plural } from "@/lib/utils";
import { BACKUP_TABLES, TABLE_LABEL, backupFileName, parseBackupText, type BackupSummary } from "./backup";

interface Counts {
  attempts: number;
  bookmarks: number;
  revisionItems: number;
  errorLogs: number;
  mockAttempts: number;
  roadmap: number;
}

async function countAll(db: GateDaDB): Promise<Counts> {
  const [attempts, bookmarks, revisionItems, errorLogs, mockAttempts, roadmap] = await Promise.all([
    db.attempts.count(),
    db.bookmarks.count(),
    db.revisionItems.count(),
    db.errorLogs.count(),
    db.mockAttempts.count(),
    db.roadmap.count(),
  ]);
  return { attempts, bookmarks, revisionItems, errorLogs, mockAttempts, roadmap };
}

const RESET_WORD = "RESET";

function download(name: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

type Notice = { tone: "success" | "danger" | "info"; title: string; lines?: string[] } | null;

export function DataManagement() {
  const { db, demo, ready, available } = useUserData();
  const counts = useDbQuery((d) => countAll(d), [], null as Counts | null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<null | "export" | "import" | "reset" | "persist">(null);
  const [pending, setPending] = useState<{ data: Record<string, unknown>; summary: BackupSummary; fileName: string } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const typedId = useId();
  const where = demo ? "the demo database" : "your data on this device";
  const disabled = !db || busy !== null;

  async function onExport() {
    if (!db) return;
    setBusy("export");
    try {
      const data = await exportAll(db);
      const name = backupFileName(demo);
      download(name, JSON.stringify(data, null, 2));
      setNotice({ tone: "success", title: `Downloaded ${name}`, lines: [`${plural(data.attempts.length, "attempt")}, ${plural(data.bookmarks.length, "bookmark")}, ${plural(data.revisionItems.length, "revision item")}, ${plural(data.errorLogs.length, "error-log entry", "error-log entries")} and ${plural(data.mockAttempts.length, "mock attempt")}. Keep it somewhere safe; it is the only copy outside this browser.`] });
    } catch (e) {
      setNotice({ tone: "danger", title: "The backup could not be created", lines: [(e as Error).message] });
    } finally {
      setBusy(null);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setNotice(null);
    if (file.size > 50 * 1024 * 1024) {
      setNotice({ tone: "danger", title: "That file is too large to be a backup", lines: [`${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB.`] });
      return;
    }
    const check = parseBackupText(await file.text());
    if (!check.ok) {
      setNotice({ tone: "danger", title: `${file.name} cannot be imported`, lines: check.errors });
      return;
    }
    if (check.summary.fromDemo && !demo) {
      setNotice({
        tone: "danger",
        title: `${file.name} was exported from the demo database`,
        lines: ["Importing it would mix demo data into your real progress, so it is refused. Turn on demo mode first if you want to load it into the demo database."],
      });
      return;
    }
    setPending({ data: check.data, summary: check.summary, fileName: file.name });
  }

  async function confirmImport() {
    if (!db || !pending) return;
    setBusy("import");
    try {
      await importAll(db, pending.data);
      setNotice({ tone: "success", title: `Imported ${pending.fileName}`, lines: [`${where[0].toUpperCase()}${where.slice(1)} now matches the backup.`] });
      setPending(null);
    } catch (e) {
      setNotice({ tone: "danger", title: "Import failed; nothing was changed", lines: [(e as Error).message || "The database rejected the backup.", "The import runs in one transaction, so your existing data is left exactly as it was."] });
      setPending(null);
    } finally {
      setBusy(null);
    }
  }

  async function confirmReset() {
    if (!db || typed !== RESET_WORD) return;
    setBusy("reset");
    try {
      await clearAll(db);
      setNotice({ tone: "success", title: demo ? "Demo database cleared" : "All your data was deleted from this browser" });
      setResetOpen(false);
      setTyped("");
    } catch (e) {
      setNotice({ tone: "danger", title: "Reset failed", lines: [(e as Error).message] });
    } finally {
      setBusy(null);
    }
  }

  async function requestPersistence() {
    setBusy("persist");
    try {
      if (!navigator.storage?.persist) {
        setNotice({ tone: "info", title: "This browser cannot pin storage", lines: ["Export a backup regularly instead."] });
        return;
      }
      const already = await navigator.storage.persisted();
      const granted = already || (await navigator.storage.persist());
      const est = navigator.storage.estimate ? await navigator.storage.estimate() : null;
      const used = est?.usage !== undefined ? ` The site currently uses about ${(est.usage / 1024 / 1024).toFixed(1)} MB.` : "";
      setNotice(
        granted
          ? { tone: "success", title: "Storage is persistent", lines: [`The browser will not clear this site's data automatically to free space.${used}`] }
          : { tone: "info", title: "The browser declined persistent storage", lines: [`Browsers often grant it only to bookmarked or installed sites, or after more use. Export a backup regularly.${used}`] },
      );
    } catch (e) {
      setNotice({ tone: "danger", title: "Could not check storage", lines: [(e as Error).message] });
    } finally {
      setBusy(null);
    }
  }

  const rows: [string, number | undefined][] = [
    ["Question attempts", counts?.attempts],
    ["Bookmarks", counts?.bookmarks],
    ["Revision items", counts?.revisionItems],
    ["Error-log entries", counts?.errorLogs],
    ["Mock attempts", counts?.mockAttempts],
    ["Roadmap stages done", counts?.roadmap],
  ];

  return (
    <Card>
      <CardHeader
        title="Your data"
        description="Everything you do is stored only in this browser (IndexedDB). There is no account and no server copy, so export a backup now and then."
        action={
          <Badge tone={demo ? "warning" : "success"}>
            <Database aria-hidden className="h-3 w-3" />
            {demo ? "Acting on: demo database" : "Acting on: your data"}
          </Badge>
        }
      />
      <CardBody className="space-y-6">
        {ready && !available ? (
          <Callout tone="warning" title="Local storage is blocked in this window">
            Private browsing or a browser setting is blocking IndexedDB, so nothing can be saved, exported or imported here. Open the site in a normal window to manage your data.
          </Callout>
        ) : null}

        <section aria-labelledby="storage-h">
          <h3 id="storage-h" className="flex items-center gap-2 text-sm font-semibold text-fg">
            <HardDrive aria-hidden className="h-4 w-4 text-fg-3" /> {demo ? "Stored in the demo database" : "Stored on this device"}
          </h3>
          <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {rows.map(([label, n]) => (
              <div key={label} className="rounded-lg border border-border px-3 py-2">
                <dt className="text-xs text-fg-3">{label}</dt>
                <dd className="tnum text-lg font-semibold text-fg">{n === undefined ? <span className="text-fg-3">—</span> : n}</dd>
              </div>
            ))}
          </dl>
          {counts && Object.values(counts).every((n) => n === 0) ? (
            <p className="mt-2 text-sm text-fg-3">{demo ? "The demo database is empty. Generate demo data below." : "Nothing is stored yet. Answer a PYQ or take a mock and it will appear here."}</p>
          ) : null}
        </section>

        <section aria-labelledby="backup-h" className="space-y-3 border-t border-border pt-5">
          <h3 id="backup-h" className="text-sm font-semibold text-fg">
            Backup and restore
          </h3>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onExport} disabled={disabled}>
              <Download aria-hidden className="h-4 w-4" /> {busy === "export" ? "Exporting…" : "Export backup (.json)"}
            </Button>
            <Button onClick={() => fileRef.current?.click()} disabled={disabled}>
              <Upload aria-hidden className="h-4 w-4" /> Import backup…
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              tabIndex={-1}
              aria-label="Choose a backup file to import"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                void onFile(f);
              }}
            />
          </div>
          <p className="text-sm text-fg-3">
            Export downloads <code className="font-mono text-xs">{backupFileName(demo)}</code> with every attempt, bookmark, revision item, error-log entry, mock attempt and setting. Importing checks the file first,
            then replaces {where} with it after you confirm.
          </p>
        </section>

        <section aria-labelledby="reset-h" className="space-y-3 border-t border-border pt-5">
          <h3 id="reset-h" className="text-sm font-semibold text-fg">
            {demo ? "Clear the demo database" : "Reset all data"}
          </h3>
          <p className="text-sm text-fg-3">
            {demo ? "Deletes all demo data. Your real data is in a different database and is not touched." : "Permanently deletes your progress, bookmarks, revision queue, error log, mock attempts and settings from this browser. Content is not affected."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" onClick={() => setResetOpen(true)} disabled={disabled}>
              <Trash2 aria-hidden className="h-4 w-4" /> {demo ? "Clear demo data…" : "Reset all data…"}
            </Button>
            <Button variant="ghost" onClick={requestPersistence} disabled={busy !== null}>
              <ShieldCheck aria-hidden className="h-4 w-4" /> Protect from automatic clearing
            </Button>
          </div>
        </section>

        <div role="status" aria-live="polite">
          {notice ? (
            <Callout tone={notice.tone} title={notice.title}>
              {notice.lines?.length ? (
                <ul className={notice.lines.length > 1 ? "list-disc space-y-0.5 pl-5" : ""}>
                  {notice.lines.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              ) : null}
            </Callout>
          ) : null}
        </div>
      </CardBody>

      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)} title="Replace data with this backup?" description={pending ? `${pending.fileName}${pending.summary.exportedAt ? `, exported ${new Date(pending.summary.exportedAt).toLocaleString()}` : ""}` : undefined}>
        {pending ? (
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium text-fg">The backup contains</p>
              <ul className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-fg-2">
                {BACKUP_TABLES.filter((t) => pending.summary.counts[t] > 0).map((t) => (
                  <li key={t}>
                    <span className="tnum font-medium text-fg">{pending.summary.counts[t]}</span> {TABLE_LABEL[t]}
                  </li>
                ))}
                {BACKUP_TABLES.every((t) => pending.summary.counts[t] === 0) ? <li className="col-span-2">No records (importing it empties {where}).</li> : null}
              </ul>
            </div>
            <Callout tone="warning" title={`Everything currently in ${where} will be replaced`}>
              {counts ? `That is ${plural(counts.attempts, "attempt")}, ${plural(counts.mockAttempts, "mock attempt")} and ${plural(counts.errorLogs, "error-log entry", "error-log entries")} now. ` : null}
              Export a backup first if you might need them.
            </Callout>
            <div className="flex flex-wrap justify-end gap-2">
              <Button onClick={() => setPending(null)}>Cancel</Button>
              <Button variant="primary" onClick={confirmImport} disabled={busy !== null}>
                {busy === "import" ? "Importing…" : "Replace with backup"}
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={resetOpen}
        onOpenChange={(o) => {
          setResetOpen(o);
          if (!o) setTyped("");
        }}
        title={demo ? "Clear the demo database?" : "Delete all your data?"}
        description={demo ? "This removes every demo record. Your real data is not affected." : "This cannot be undone. Your attempts, bookmarks, revision queue, error log, mock attempts, roadmap and settings will be deleted from this browser."}
      >
        <form
          className="space-y-4 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            void confirmReset();
          }}
        >
          {!demo && counts && counts.attempts + counts.mockAttempts + counts.errorLogs + counts.bookmarks > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
              <span className="text-fg-2">
                {plural(counts.attempts, "attempt")} and {plural(counts.mockAttempts, "mock attempt")} will be lost.
              </span>
              <Button size="sm" onClick={onExport} disabled={busy !== null}>
                <Download aria-hidden className="h-4 w-4" /> Export first
              </Button>
            </div>
          ) : null}
          <div>
            <label htmlFor={typedId} className="block font-medium text-fg">
              Type <span className="font-mono">{RESET_WORD}</span> to confirm
            </label>
            <input
              id={typedId}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="mt-1 h-10 w-full rounded-lg border border-border-strong bg-surface px-3 font-mono text-fg"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              onClick={() => {
                setResetOpen(false);
                setTyped("");
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={typed !== RESET_WORD || busy !== null}>
              <Trash2 aria-hidden className="h-4 w-4" /> {busy === "reset" ? "Deleting…" : demo ? "Clear demo data" : "Delete everything"}
            </Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}
