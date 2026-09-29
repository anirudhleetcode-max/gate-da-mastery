import { describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { createDb } from "@/lib/userdata/db";
import { exportAll, importAll } from "@/lib/userdata/ops";
import { backupFileName, checkBackup, parseBackupText } from "./backup";

const base = { app: "gate-da-mastery", version: 1, exportedAt: "2026-09-01T10:00:00.000Z" };

describe("checkBackup", () => {
  it("accepts a real export and summarises it", async () => {
    const db = createDb("backup-check-test");
    await db.open();
    await db.attempts.add({ questionId: "DA2025-S5-Q12", origin: "OFFICIAL_PYQ", subjectId: "la", topicId: "t", context: "pyq", response: null, status: "correct", marksAwarded: 1, maxMarks: 1, timeSpentMs: 1000, createdAt: "2026-09-01T10:00:00.000Z", day: "2026-09-01" });
    await db.bookmarks.put({ key: "question:DA2025-S5-Q12", kind: "question", refId: "DA2025-S5-Q12", title: "Q", createdAt: "2026-09-01T10:00:00.000Z" });
    const exported = JSON.parse(JSON.stringify(await exportAll(db)));
    const r = checkBackup(exported);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.summary.counts.attempts).toBe(1);
      expect(r.summary.counts.bookmarks).toBe(1);
      expect(r.summary.fromDemo).toBe(false);
      // And importAll accepts what checkBackup accepted.
      await importAll(db, r.data);
      expect(await db.attempts.count()).toBe(1);
    }
    db.close();
  });

  it("rejects files that are not backups", () => {
    expect(parseBackupText("not json").ok).toBe(false);
    expect(checkBackup([]).ok).toBe(false);
    expect(checkBackup({ app: "something-else", version: 1 }).ok).toBe(false);
    expect(checkBackup({ app: "gate-da-mastery" }).ok).toBe(false);
    const newer = checkBackup({ ...base, version: 99 });
    expect(newer.ok === false && newer.errors[0]).toMatch(/newer version/);
  });

  it("rejects malformed tables, missing keys and duplicate keys", () => {
    expect(checkBackup({ ...base, attempts: "oops" }).ok).toBe(false);
    expect(checkBackup({ ...base, bookmarks: [{ kind: "question" }] }).ok).toBe(false);
    expect(checkBackup({ ...base, attempts: [{ id: "x", questionId: "q", status: "correct", createdAt: "t" }] }).ok).toBe(false);
    const dup = checkBackup({ ...base, settings: [{ key: "a", value: 1 }, { key: "a", value: 2 }] });
    expect(dup.ok === false && dup.errors[0]).toMatch(/twice/);
    expect(checkBackup({ ...base, attempts: [{ questionId: "q" }] }).ok).toBe(false);
  });

  it("flags a backup exported from the demo database", () => {
    const r = checkBackup({ ...base, settings: [{ key: "demoInfo", value: { seed: 1 } }] });
    expect(r.ok && r.summary.fromDemo).toBe(true);
  });

  it("names files by date and database", () => {
    const d = new Date(2026, 8, 29, 12);
    expect(backupFileName(false, d)).toBe("gate-da-backup-2026-09-29.json");
    expect(backupFileName(true, d)).toBe("gate-da-demo-backup-2026-09-29.json");
  });
});
