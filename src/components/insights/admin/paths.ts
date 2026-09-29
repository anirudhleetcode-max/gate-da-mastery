/**
 * Path safety for the admin content editor.
 *
 * A requested path is accepted only if it is a relative "content/…/*.json"
 * path that resolves inside the project's content directory, contains no
 * traversal segments, and does not pass through a symbolic link (checked on
 * disk, component by component, and again with realpath).
 */
import fs from "node:fs";
import path from "node:path";

export type PathCheck =
  | { ok: true; rel: string; abs: string }
  | { ok: false; status: 400 | 403 | 404; error: string };

const MAX_LEN = 300;

/**
 * Pure (string-only) checks: shape, absolute paths, traversal, extension.
 * Returns the normalised relative path ("content/…") or an error.
 */
export function checkContentPathSyntax(input: unknown): { ok: true; rel: string } | { ok: false; error: string } {
  if (typeof input !== "string" || input.length === 0) return { ok: false, error: "A file path is required." };
  if (input.length > MAX_LEN) return { ok: false, error: "The path is too long." };
  if (/[\u0000-\u001f\u007f]/.test(input)) return { ok: false, error: "The path contains control characters." };
  if (input.includes("\\")) return { ok: false, error: "Use forward slashes; backslashes are not allowed." };
  if (path.posix.isAbsolute(input) || path.win32.isAbsolute(input) || /^[a-zA-Z]:/.test(input) || input.startsWith("~")) {
    return { ok: false, error: "Absolute paths are not allowed; use a path relative to the project, e.g. content/sources.json." };
  }
  const segments = input.split("/");
  if (segments.some((s) => s === "" || s === "." || s === "..")) return { ok: false, error: "Path traversal and empty segments are not allowed." };
  if (segments[0] !== "content" || segments.length < 2) return { ok: false, error: "Only files inside content/ can be opened." };
  const base = segments[segments.length - 1];
  if (!base.endsWith(".json") || base === ".json") return { ok: false, error: "Only .json files can be opened." };
  if (base.startsWith(".")) return { ok: false, error: "Hidden and temporary files cannot be opened." };
  return { ok: true, rel: segments.join("/") };
}

/**
 * Full check against the file system. `projectRoot` is the directory that
 * contains content/ (process.cwd() in the app; a temp directory in tests).
 */
export function resolveContentPath(input: unknown, projectRoot: string, opts: { mustExist?: boolean } = { mustExist: true }): PathCheck {
  const syntax = checkContentPathSyntax(input);
  if (!syntax.ok) return { ok: false, status: 400, error: syntax.error };
  const contentRoot = path.resolve(projectRoot, "content");
  const abs = path.resolve(projectRoot, syntax.rel);
  const relToRoot = path.relative(contentRoot, abs);
  if (!relToRoot || relToRoot.startsWith("..") || path.isAbsolute(relToRoot)) {
    return { ok: false, status: 400, error: "The path must resolve inside the content directory." };
  }

  // No symbolic links anywhere on the way: content/ itself, each directory, the file.
  let cur = contentRoot;
  const parts = ["", ...relToRoot.split(path.sep)];
  for (const [i, part] of parts.entries()) {
    cur = part ? path.join(cur, part) : cur;
    let st: fs.Stats;
    try {
      st = fs.lstatSync(cur);
    } catch {
      if (opts.mustExist === false && i === parts.length - 1) break;
      return { ok: false, status: 404, error: `Not found: ${syntax.rel}` };
    }
    if (st.isSymbolicLink()) return { ok: false, status: 403, error: "Symbolic links are not allowed." };
    const last = i === parts.length - 1;
    if (!last && !st.isDirectory()) return { ok: false, status: 400, error: "The path goes through something that is not a directory." };
    if (last && !st.isFile()) return { ok: false, status: 400, error: "The path is not a regular file." };
  }

  // Defence in depth: the real (resolved) location must still be inside the real content root.
  try {
    const realRoot = fs.realpathSync(contentRoot);
    const realParent = fs.realpathSync(path.dirname(abs));
    const r = path.relative(realRoot, realParent);
    if (r.startsWith("..") || path.isAbsolute(r)) return { ok: false, status: 403, error: "The path resolves outside the content directory." };
  } catch {
    return { ok: false, status: 404, error: `Not found: ${syntax.rel}` };
  }
  return { ok: true, rel: syntax.rel, abs };
}

/** Every .json file under content/ (relative "content/…" paths, sorted), never following symlinks. */
export function listContentJsonFiles(projectRoot: string): string[] {
  const root = path.resolve(projectRoot, "content");
  const out: string[] = [];
  const walk = (dir: string, rel: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isSymbolicLink() || e.name.startsWith(".")) continue;
      const r = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(path.join(dir, e.name), r);
      else if (e.isFile() && e.name.endsWith(".json")) out.push(r);
    }
  };
  walk(root, "content");
  return out.sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}
