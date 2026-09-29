import { beforeEach, describe, expect, it } from "vitest";
import { createDb, type GateDaDB } from "@/lib/userdata/db";
import { addErrorLog, addToRevision, clearAll, dueRevision, exportAll, gradeRevision, importAll, recordAttemptWithFollowUps, toggleBookmark, updateErrorLog } from "@/lib/userdata/ops";

let db: GateDaDB;
let n = 0;
beforeEach(async () => {
  db = createDb(`test-${n++}`);
  await db.open();
});

const attempt = (status: "correct" | "incorrect") => ({
  questionId: "DA2026-S8-Q36",
  origin: "OFFICIAL_PYQ" as const,
  subjectId: "ml" as const,
  topicId: "ml-clustering",
  context: "pyq" as const,
  response: { kind: "MCQ" as const, choice: "B" as const },
  status,
  marksAwarded: status === "correct" ? 2 : -2 / 3,
  maxMarks: 2,
  timeSpentMs: 30000,
});

describe("attempts & automatic follow-ups", () => {
  it("records an attempt and queues incorrect answers for revision", async () => {
    await recordAttemptWithFollowUps(db, attempt("incorrect"), { title: "GATE DA 2026 · Q.36" }, new Date("2026-10-01T10:00:00"));
    expect(await db.attempts.count()).toBe(1);
    const due = await dueRevision(db, new Date("2026-10-01T12:00:00"));
    expect(due).toHaveLength(1);
    expect(due[0].reasons).toEqual(["incorrect"]);
  });
  it("does not queue correct answers", async () => {
    await recordAttemptWithFollowUps(db, attempt("correct"), { title: "t" });
    expect(await db.revisionItems.count()).toBe(0);
  });
});

describe("bookmarks", () => {
  it("toggles on and off", async () => {
    expect(await toggleBookmark(db, { kind: "concept", refId: "c-ml-pca", title: "PCA" })).toBe(true);
    expect(await db.bookmarks.count()).toBe(1);
    expect(await toggleBookmark(db, { kind: "concept", refId: "c-ml-pca", title: "PCA" })).toBe(false);
    expect(await db.bookmarks.count()).toBe(0);
  });
});

describe("revision queue", () => {
  it("merges reasons and schedules after grading", async () => {
    await addToRevision(db, { kind: "question", refId: "q1", title: "Q1", reason: "bookmarked" }, new Date("2026-10-01T10:00:00"));
    await addToRevision(db, { kind: "question", refId: "q1", title: "Q1", reason: "incorrect" }, new Date("2026-10-01T10:00:00"));
    const item = await db.revisionItems.get("question:q1");
    expect(item?.reasons).toEqual(["bookmarked", "incorrect"]);
    const graded = await gradeRevision(db, "question:q1", "got_it", new Date("2026-10-01T11:00:00"));
    expect(graded).toMatchObject({ nextReview: "2026-10-04", reviewCount: 1, confidence: "got_it" });
    expect(await dueRevision(db, new Date("2026-10-02T10:00:00"))).toHaveLength(0);
    expect(await dueRevision(db, new Date("2026-10-04T10:00:00"))).toHaveLength(1);
  });
});

describe("error log", () => {
  it("keeps one open entry per question and supports classification", async () => {
    const base = { questionId: "q1", origin: "OFFICIAL_PYQ" as const, subjectId: "ps" as const, topicId: "ps-conditional", title: "Q1", yourAnswer: "A", correctAnswer: "B" };
    const id1 = await addErrorLog(db, base);
    const id2 = await addErrorLog(db, { ...base, yourAnswer: "C", mistakeType: "calculation" });
    expect(id2).toBe(id1);
    const row = await db.errorLogs.get(id1);
    expect(row).toMatchObject({ yourAnswer: "C", mistakeType: "calculation", revisionStatus: "open" });
    await updateErrorLog(db, id1, { revisionStatus: "resolved", note: "watch signs" });
    const id3 = await addErrorLog(db, base);
    expect(id3).not.toBe(id1);
  });
});

describe("backup", () => {
  it("round-trips export → clear → import and rejects foreign files", async () => {
    await recordAttemptWithFollowUps(db, attempt("incorrect"), { title: "t" });
    await toggleBookmark(db, { kind: "formula", refId: "f1", title: "F" });
    const backup = await exportAll(db);
    await clearAll(db);
    expect(await db.attempts.count()).toBe(0);
    await importAll(db, JSON.parse(JSON.stringify(backup)));
    expect(await db.attempts.count()).toBe(1);
    expect(await db.bookmarks.count()).toBe(1);
    expect(await db.revisionItems.count()).toBe(1);
    await expect(importAll(db, { app: "other" })).rejects.toThrow(/Not a GATE DA Mastery backup/);
  });
  it("drops invalid rows and neutralises crafted snapshots in an imported backup", async () => {
    await recordAttemptWithFollowUps(db, attempt("correct"), { title: "t" });
    const backup = JSON.parse(JSON.stringify(await exportAll(db)));
    backup.attempts.push({ questionId: "<img src=x onerror=alert(1)>", status: "hacked" });
    backup.bookmarks = [
      { key: "question:A", kind: "question", refId: "A", title: "A", createdAt: new Date().toISOString(), snapshot: { html: '<div class="fixed inset-0 z-50">x</div>', href: "https://evil.example/", savedAt: new Date().toISOString() } },
      { key: "question:B", kind: "question", refId: "B", title: "B", createdAt: new Date().toISOString(), snapshot: { html: "<p>ok</p>", href: "/questions/B", savedAt: new Date().toISOString() } },
      { key: "bad", kind: "virus", refId: "C", title: "C", createdAt: "x" },
    ];
    await clearAll(db);
    const { imported, dropped } = await importAll(db, backup);
    expect(imported.attempts).toBe(1);
    expect(dropped.attempts).toBe(1);
    expect(dropped.bookmarks).toBe(1);
    const a = await db.bookmarks.get("question:A");
    expect(a?.snapshot).toBeUndefined(); // off-site link → snapshot removed
    const b = await db.bookmarks.get("question:B");
    expect(b?.snapshot?.href).toBe("/questions/B");
    expect(b?.snapshot?.html).not.toContain("fixed"); // sanitised (empty without a DOM in this test runner)
  });
});
