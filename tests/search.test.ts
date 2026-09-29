import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const bundlePath = path.resolve(__dirname, "../generated/content.json");

describe.runIf(fs.existsSync(bundlePath))("search over the compiled bundle", async () => {
  const repo = await import("@/lib/server/repo");
  it("finds topics, subjects and PYQs and groups them by category", () => {
    const r = repo.searchContent("principal component analysis");
    expect(r.length).toBeGreaterThan(0);
    expect(r.some((x) => x.category === "topic" || x.category === "pyq" || x.category === "concept")).toBe(true);
  });
  it("searches by year and question number", () => {
    const r = repo.searchContent("2026 Q36");
    expect(r.some((x) => x.id === "DA2026-S8-Q36")).toBe(true);
  });
  it("tolerates typos and ignores 1-character queries", () => {
    expect(repo.searchContent("eigenvalu").length).toBeGreaterThan(0);
    expect(repo.searchContent("a")).toEqual([]);
  });
  it("never indexes unattempted mock questions", () => {
    expect(repo.searchContent("mock").every((x) => x.category !== "pyq" || !x.id.startsWith("M"))).toBe(true);
    expect(repo.getBundle().searchDocs.some((d) => /^M\d\d-Q/.test(d.id))).toBe(false);
  });
});
