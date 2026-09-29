/**
 * The availability gate (src/lib/content/availability.ts) enforced in logic:
 * the compiler, the server repository and the API routes must never expose a
 * mock (or its questions) unless every question in it is VERIFIED.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { compileContent } from "@/lib/content/compile";
import { isServable, mockAvailability, servableIds, type GateQuestion } from "@/lib/content/availability";
import type { CompiledQuestion, ContentBundle } from "@/lib/content/types";
import { loadRawContent } from "../scripts/content/build";

const ROOT = path.resolve(__dirname, "..");

describe("mockAvailability (pure)", () => {
  const q = (id: string, reviewStatus: GateQuestion["reviewStatus"]): GateQuestion => ({ id, origin: "MOCK_TEST", testId: "mock-99", reviewStatus });
  const lookup = (qs: GateQuestion[]) => (id: string) => qs.find((x) => x.id === id);
  it("is available only when every planned question is present and VERIFIED", () => {
    const all = [q("a", "VERIFIED"), q("b", "VERIFIED")];
    expect(mockAvailability(["a", "b"], lookup(all))).toEqual({ missing: [], verifiedCount: 2, available: true });
  });
  it.each(["DRAFT", "SELF_CHECKED", "NEEDS_REVIEW", undefined] as const)("one %s question makes the whole mock unavailable", (status) => {
    const r = mockAvailability(["a", "b"], lookup([q("a", "VERIFIED"), q("b", status)]));
    expect(r.available).toBe(false);
    expect(r.verifiedCount).toBe(1);
  });
  it("a missing question makes the mock unavailable, even if the rest are verified", () => {
    expect(mockAvailability(["a", "b"], lookup([q("a", "VERIFIED")]))).toEqual({ missing: ["b"], verifiedCount: 1, available: false });
  });
  it("an empty mock is never available", () => {
    expect(mockAvailability([], lookup([])).available).toBe(false);
  });
});

describe("isServable / servableIds (pure)", () => {
  const avail = new Set(["mock-01"]);
  it("official PYQs are always servable", () => {
    expect(isServable({ id: "p", origin: "OFFICIAL_PYQ" }, avail)).toBe(true);
  });
  it("mock questions are servable only when verified AND their mock is available", () => {
    expect(isServable({ id: "m", origin: "MOCK_TEST", testId: "mock-01", reviewStatus: "VERIFIED" }, avail)).toBe(true);
    expect(isServable({ id: "m", origin: "MOCK_TEST", testId: "mock-02", reviewStatus: "VERIFIED" }, avail)).toBe(false);
    expect(isServable({ id: "m", origin: "MOCK_TEST", testId: "mock-01", reviewStatus: "SELF_CHECKED" }, avail)).toBe(false);
    expect(isServable({ id: "m", origin: "MOCK_TEST", reviewStatus: "VERIFIED" }, avail)).toBe(false);
  });
  it("practice questions are servable only when VERIFIED", () => {
    expect(isServable({ id: "x", origin: "ORIGINAL_PRACTICE", reviewStatus: "VERIFIED" }, avail)).toBe(true);
    expect(isServable({ id: "x", origin: "ORIGINAL_PRACTICE", reviewStatus: "DRAFT" }, avail)).toBe(false);
  });
  it("servableIds combines both rules", () => {
    const ids = servableIds(
      [
        { id: "p", origin: "OFFICIAL_PYQ" },
        { id: "m1", origin: "MOCK_TEST", testId: "mock-01", reviewStatus: "VERIFIED" },
        { id: "m2", origin: "MOCK_TEST", testId: "mock-02", reviewStatus: "VERIFIED" },
      ],
      [
        { id: "mock-01", available: true },
        { id: "mock-02", available: false },
      ],
    );
    expect([...ids].sort()).toEqual(["m1", "p"]);
  });
});

// ---------------------------------------------------------------- real content
let bundle: ContentBundle;
beforeAll(() => {
  bundle = compileContent(loadRawContent(), { figureExists: (p) => fs.existsSync(path.join(ROOT, "public", p)) }).bundle;
}, 120_000);

describe("compiled bundle obeys the gate", () => {
  it("a mock is marked available exactly when all of its questions are present and VERIFIED", () => {
    const byId = new Map(bundle.questions.map((q) => [q.id, q]));
    for (const m of bundle.mocks) {
      const qs = m.questionIds.map((id) => byId.get(id));
      const expected = qs.length > 0 && qs.every((q) => q?.reviewStatus === "VERIFIED");
      expect(m.available, m.id).toBe(expected);
      expect(m.verifiedCount, m.id).toBe(qs.filter((q) => q?.reviewStatus === "VERIFIED").length);
    }
  });
  it("similar-question links and search never point at gated questions", () => {
    const servable = servableIds(bundle.questions, bundle.mocks);
    for (const q of bundle.questions) for (const s of q.similarIds) expect(servable.has(s), `${q.id} → ${s}`).toBe(true);
    const qIds = new Set(bundle.questions.map((q) => q.id));
    for (const d of bundle.searchDocs) if (qIds.has(d.id)) expect(servable.has(d.id), d.id).toBe(true);
  });
});

// ---------------------------------------------------------------- server + API
describe("server repository and API routes enforce the gate", () => {
  const cwd = process.cwd();
  let tmp: string;
  let open: ContentBundle["mocks"][number];
  let closed: ContentBundle["mocks"][number];
  let closedQuestion: CompiledQuestion;

  beforeAll(async () => {
    // A synthetic but faithful bundle: one fully verified mock and one with an unverified question.
    const b: ContentBundle = structuredClone(bundle);
    const mocksWithQs = b.mocks.filter((m) => m.questionIds.every((id) => b.questions.some((q) => q.id === id)));
    expect(mocksWithQs.length).toBeGreaterThanOrEqual(2);
    open = mocksWithQs[0];
    closed = mocksWithQs[1];
    for (const q of b.questions) if (open.questionIds.includes(q.id)) q.reviewStatus = "VERIFIED";
    closedQuestion = b.questions.find((q) => q.id === closed.questionIds[0])!;
    for (const q of b.questions) if (closed.questionIds.includes(q.id)) q.reviewStatus = "VERIFIED";
    closedQuestion.reviewStatus = "SELF_CHECKED";
    for (const m of b.mocks) {
      const r = mockAvailability(m.questionIds, (id) => b.questions.find((q) => q.id === id));
      Object.assign(m, { available: r.available, verifiedCount: r.verifiedCount });
    }
    open = b.mocks.find((m) => m.id === open.id)!;
    closed = b.mocks.find((m) => m.id === closed.id)!;
    expect(open.available).toBe(true);
    expect(closed.available).toBe(false);

    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gate-avail-"));
    fs.mkdirSync(path.join(tmp, "generated"));
    fs.writeFileSync(path.join(tmp, "generated", "content.json"), JSON.stringify(b));
    process.chdir(tmp);
    vi.resetModules();
  }, 120_000);

  afterAll(() => {
    process.chdir(cwd);
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  });

  const params = (id: string) => ({ params: Promise.resolve({ id }) });

  it("paper route serves questions only for an available mock", async () => {
    const { GET } = await import("@/app/api/mocks/[id]/paper/route");
    const ok = await (await GET(new Request("http://x"), params(open.id))).json();
    expect(ok.questions).toHaveLength(open.questionIds.length);
    const res = await GET(new Request("http://x"), params(closed.id));
    const body = await res.json();
    expect(body.test.available).toBe(false);
    expect(body.questions).toEqual([]);
    expect((await GET(new Request("http://x"), params("mock-404"))).status).toBe(404);
  });

  it("key route refuses an unavailable mock", async () => {
    const { GET } = await import("@/app/api/mocks/[id]/key/route");
    expect((await GET(new Request("http://x"), params(open.id))).status).toBe(200);
    expect((await GET(new Request("http://x"), params(closed.id))).status).toBe(403);
  });

  it("question routes do not leak questions of an unavailable mock", async () => {
    const one = await import("@/app/api/questions/[id]/route");
    expect((await one.GET(new Request("http://x"), params(closedQuestion.id))).status).toBe(404);
    const sibling = closed.questionIds[1];
    expect((await one.GET(new Request("http://x"), params(sibling))).status).toBe(404);
    expect((await one.GET(new Request("http://x"), params(open.questionIds[0]))).status).toBe(200);
    const batch = await import("@/app/api/questions/batch/route");
    const ids = [closedQuestion.id, sibling, open.questionIds[0]].join(",");
    const out = (await (await batch.GET(new Request(`http://x/?ids=${ids}`))).json()) as { id: string }[];
    expect(out.map((q) => q.id)).toEqual([open.questionIds[0]]);
  });

  it("practice and metadata pools exclude gated questions", async () => {
    const repo = await import("@/lib/server/repo");
    const all = new Set(repo.getAllMetas().map((m) => m.id));
    for (const id of closed.questionIds) expect(all.has(id), id).toBe(false);
    for (const id of open.questionIds) expect(all.has(id), id).toBe(true);
    expect(repo.getPracticePoolMetas().some((m) => m.origin === "MOCK_TEST")).toBe(false);
    expect(repo.getMockQuestions(closed.id)).toEqual([]);
    expect(repo.getQuestionUnchecked(closedQuestion.id)?.id).toBe(closedQuestion.id);
  });
});
