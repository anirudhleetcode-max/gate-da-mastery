import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkContentPathSyntax, listContentJsonFiles, resolveContentPath } from "./paths";
import { isAdminEnabled } from "./access";

let root = "";
let outside = "";

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "gate-da-admin-"));
  outside = fs.mkdtempSync(path.join(os.tmpdir(), "gate-da-outside-"));
  fs.mkdirSync(path.join(root, "content", "pyqs", "2024"), { recursive: true });
  fs.writeFileSync(path.join(root, "content", "sources.json"), "[]\n");
  fs.writeFileSync(path.join(root, "content", "pyqs", "2024", "DA2024-S1-Q01.json"), "{}\n");
  fs.writeFileSync(path.join(root, "content", "notes.txt"), "not json\n");
  fs.writeFileSync(path.join(root, "secret.json"), "{}\n");
  fs.writeFileSync(path.join(outside, "evil.json"), "{}\n");
  fs.symlinkSync(path.join(outside, "evil.json"), path.join(root, "content", "link.json"));
  fs.symlinkSync(outside, path.join(root, "content", "linkdir"));
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(outside, { recursive: true, force: true });
});

describe("checkContentPathSyntax", () => {
  it("accepts relative content/*.json paths", () => {
    expect(checkContentPathSyntax("content/sources.json")).toEqual({ ok: true, rel: "content/sources.json" });
    expect(checkContentPathSyntax("content/pyqs/2024/DA2024-S1-Q01.json").ok).toBe(true);
  });

  it("rejects traversal segments", () => {
    for (const p of ["content/../secret.json", "content/pyqs/../../secret.json", "../content/sources.json", "content/./sources.json", "content//sources.json"]) {
      expect(checkContentPathSyntax(p).ok, p).toBe(false);
    }
  });

  it("rejects absolute paths (POSIX, Windows, home)", () => {
    for (const p of ["/etc/passwd.json", "/home/user/gate-da-mastery/content/sources.json", "C:\\content\\x.json", "C:/content/x.json", "\\\\server\\share\\x.json", "~/content/x.json"]) {
      expect(checkContentPathSyntax(p).ok, p).toBe(false);
    }
  });

  it("rejects non-json files, hidden files and paths outside content/", () => {
    for (const p of ["content/notes.txt", "content/sources.json.bak", "content/.hidden.json", "content/.json", "content", "generated/content.json", "secret.json", "content/sources.JSON"]) {
      expect(checkContentPathSyntax(p).ok, p).toBe(false);
    }
  });

  it("rejects non-strings, empty strings, control characters and backslashes", () => {
    for (const p of [undefined, null, 42, "", "content/a\u0000.json", "content\\sources.json"]) {
      expect(checkContentPathSyntax(p).ok, String(p)).toBe(false);
    }
  });
});

describe("resolveContentPath", () => {
  it("resolves an existing file inside content/", () => {
    const r = resolveContentPath("content/pyqs/2024/DA2024-S1-Q01.json", root);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.abs).toBe(path.join(root, "content", "pyqs", "2024", "DA2024-S1-Q01.json"));
  });

  it("rejects symlinked files and directories", () => {
    const f = resolveContentPath("content/link.json", root);
    expect(f.ok).toBe(false);
    if (!f.ok) expect(f.status).toBe(403);
    const d = resolveContentPath("content/linkdir/evil.json", root);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.status).toBe(403);
  });

  it("returns 404 for a missing file and 400 for traversal", () => {
    const missing = resolveContentPath("content/nope.json", root);
    expect(missing.ok === false && missing.status === 404).toBe(true);
    const trav = resolveContentPath("content/../secret.json", root);
    expect(trav.ok === false && trav.status === 400).toBe(true);
  });

  it("lists json files without following symlinks", () => {
    expect(listContentJsonFiles(root)).toEqual(["content/pyqs/2024/DA2024-S1-Q01.json", "content/sources.json"]);
  });
});

describe("isAdminEnabled", () => {
  it("is enabled only in development or with ADMIN_ENABLED=true", () => {
    expect(isAdminEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(isAdminEnabled({ NODE_ENV: "production", ADMIN_ENABLED: "true" })).toBe(true);
    expect(isAdminEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(isAdminEnabled({ NODE_ENV: "production", ADMIN_ENABLED: "1" })).toBe(false);
    expect(isAdminEnabled({ NODE_ENV: "test" })).toBe(false);
  });
});
