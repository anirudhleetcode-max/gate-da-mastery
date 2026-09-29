import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const REPO = path.resolve(__dirname, "../../../..");
const PYQ = "content/pyqs/2024/DA2024-S1-Q01.json";
let root = "";

const copy = (rel: string) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.copyFileSync(path.join(REPO, rel), path.join(root, rel));
};
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");
const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

async function route() {
  return import("@/app/api/admin/file/route");
}
function put(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/admin/file", { method: "PUT", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
}

const hasContent = fs.existsSync(path.join(REPO, PYQ));

describe.runIf(hasContent)("/api/admin/file", () => {
  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "gate-da-admin-api-"));
    for (const rel of ["content/syllabus.json", "content/exam/papers.json", "content/exam/official-keys.json", PYQ]) copy(rel);
    vi.spyOn(process, "cwd").mockReturnValue(root);
  });
  afterEach(() => vi.unstubAllEnvs());
  afterAll(() => {
    vi.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("answers 404 for GET and PUT when admin is disabled", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_ENABLED", "");
    const { GET, PUT } = await route();
    expect((await GET(new Request(`http://localhost/api/admin/file?path=${PYQ}`))).status).toBe(404);
    expect((await PUT(put({ path: "content/exam/papers.json", content: "[]" }))).status).toBe(404);
  });

  it("reads a file with its hash, and rejects unsafe paths", async () => {
    vi.stubEnv("ADMIN_ENABLED", "true");
    const { GET } = await route();
    const r = await GET(new Request(`http://localhost/api/admin/file?path=${encodeURIComponent("content/exam/papers.json")}`));
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d.sha256).toBe(sha(read("content/exam/papers.json")));
    for (const bad of ["content/../package.json", "/etc/passwd", "content/exam/papers.txt"]) {
      expect((await GET(new Request(`http://localhost/api/admin/file?path=${encodeURIComponent(bad)}`))).status).toBe(400);
    }
  });

  it("validates before writing: schema errors return 422 and nothing is written", async () => {
    vi.stubEnv("ADMIN_ENABLED", "true");
    const { PUT } = await route();
    const before = read("content/exam/papers.json");
    const bad = await PUT(put({ path: "content/exam/papers.json", content: '[{"id": 1}]' }));
    expect(bad.status).toBe(422);
    expect((await bad.json()).issues.length).toBeGreaterThan(0);
    const syntax = await PUT(put({ path: "content/exam/papers.json", content: "[{" }));
    expect(syntax.status).toBe(422);
    expect(read("content/exam/papers.json")).toBe(before);
  });

  it("writes a valid file atomically and refuses a stale base hash", async () => {
    vi.stubEnv("ADMIN_ENABLED", "true");
    const { PUT } = await route();
    const before = read("content/exam/papers.json");
    const data = JSON.parse(before);
    data[0].scheduleNotes = `${data[0].scheduleNotes} (edited in test)`;
    const next = JSON.stringify(data, null, 2);
    const stale = await PUT(put({ path: "content/exam/papers.json", content: next, baseSha256: "0".repeat(64) }));
    expect(stale.status).toBe(409);
    expect((await stale.json()).conflict).toBe(true);
    const ok = await PUT(put({ path: "content/exam/papers.json", content: next, baseSha256: sha(before) }));
    expect(ok.status).toBe(200);
    const d = await ok.json();
    expect(read("content/exam/papers.json")).toBe(`${next}\n`);
    expect(d.reminders.join(" ")).toContain("content:build");
    expect(fs.readdirSync(path.join(root, "content/exam")).some((f) => f.endsWith(".tmp"))).toBe(false);
  });

  it("refuses to write an official PYQ without a freeze reason", async () => {
    vi.stubEnv("ADMIN_ENABLED", "true");
    const { PUT } = await route();
    const before = read(PYQ);
    const q = JSON.parse(before);
    q.estimatedTimeSec += 1;
    const next = JSON.stringify(q, null, 2);
    const refused = await PUT(put({ path: PYQ, content: next }));
    expect(refused.status).toBe(409);
    expect((await refused.json()).requiresFreezeReason).toBe(true);
    expect(read(PYQ)).toBe(before);
    const ok = await PUT(put({ path: PYQ, content: next, freezeReason: "test: timing estimate" }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).reminders.join(" ")).toContain("content:freeze-pyqs");
  });

  it("keeps generated and official-key files read-only, and blocks cross-origin writes", async () => {
    vi.stubEnv("ADMIN_ENABLED", "true");
    const { PUT } = await route();
    const keys = read("content/exam/official-keys.json");
    expect((await PUT(put({ path: "content/exam/official-keys.json", content: keys }))).status).toBe(403);
    expect((await PUT(put({ path: "content/exam/papers.json", content: read("content/exam/papers.json") }, { origin: "https://evil.example" }))).status).toBe(403);
  });
});
