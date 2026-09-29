import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { diskBundleBuiltAt, editHref } from "./data";

describe("diskBundleBuiltAt", () => {
  const dirs: string[] = [];
  afterEach(() => {
    vi.restoreAllMocks();
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
  });

  it("reads builtAt from the head of generated/content.json without parsing the whole file", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "gate-da-bundle-"));
    dirs.push(root);
    fs.mkdirSync(path.join(root, "generated"));
    fs.writeFileSync(path.join(root, "generated", "content.json"), `{"version":"abc","builtAt":"2026-09-29T21:47:44.651Z","syllabus":${"x".repeat(5000)}`);
    vi.spyOn(process, "cwd").mockReturnValue(root);
    expect(diskBundleBuiltAt()).toBe("2026-09-29T21:47:44.651Z");
  });

  it("returns null when there is no bundle on disk", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "gate-da-bundle-"));
    dirs.push(root);
    vi.spyOn(process, "cwd").mockReturnValue(root);
    expect(diskBundleBuiltAt()).toBeNull();
  });
});

describe("editHref", () => {
  it("encodes the file path as a query parameter", () => {
    expect(editHref("content/pyqs/2024/DA2024-S1-Q14.json")).toBe("/admin/edit?file=content%2Fpyqs%2F2024%2FDA2024-S1-Q14.json");
  });
});
