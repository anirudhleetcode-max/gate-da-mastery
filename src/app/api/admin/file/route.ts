/**
 * Admin content-file API (development / ADMIN_ENABLED=true only; 404 otherwise).
 *
 *   GET /api/admin/file?path=content/…json
 *     → { path, content, sha256, size, modifiedAt, info }
 *   PUT /api/admin/file
 *     body { path, content, baseSha256?, freezeReason?, dryRun?, force? }
 *     → validates (JSON → Zod schema by path → semantic checks) and, unless
 *       dryRun, writes atomically. Official PYQ files additionally require a
 *       non-empty freezeReason.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { isAdminEnabled } from "@/components/insights/admin/access";
import { resolveContentPath } from "@/components/insights/admin/paths";
import { fileKind, validateContentFile } from "@/components/insights/admin/validateFile";

const MAX_BYTES = 8 * 1024 * 1024;
const notFound = () => NextResponse.json({ error: "not found" }, { status: 404 });
const sha256 = (buf: Buffer | string) => crypto.createHash("sha256").update(buf).digest("hex");
const noStore = { "Cache-Control": "no-store" };

/** Reject cross-site writes (defence in depth for a dev server on localhost). */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(req.url).host || new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  if (!isAdminEnabled()) return notFound();
  const p = resolveContentPath(new URL(req.url).searchParams.get("path"), process.cwd());
  if (!p.ok) return NextResponse.json({ error: p.error }, { status: p.status, headers: noStore });
  const buf = fs.readFileSync(p.abs);
  const st = fs.statSync(p.abs);
  return NextResponse.json(
    { path: p.rel, content: buf.toString("utf8"), sha256: sha256(buf), size: st.size, modifiedAt: st.mtime.toISOString(), info: fileKind(p.rel) },
    { headers: noStore },
  );
}

interface PutBody {
  path?: unknown;
  content?: unknown;
  baseSha256?: unknown;
  freezeReason?: unknown;
  dryRun?: unknown;
  force?: unknown;
}

export async function PUT(req: Request) {
  if (!isAdminEnabled()) return notFound();
  if (!sameOrigin(req)) return NextResponse.json({ error: "Cross-origin writes are not allowed." }, { status: 403 });
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) {
    return NextResponse.json({ error: "Send the request body as application/json." }, { status: 415 });
  }
  const raw = await req.text();
  if (Buffer.byteLength(raw) > MAX_BYTES + 4096) return NextResponse.json({ error: "The file is too large to save from the browser." }, { status: 413 });
  let body: PutBody;
  try {
    body = JSON.parse(raw) as PutBody;
  } catch {
    return NextResponse.json({ error: "The request body is not valid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  if (typeof body.content !== "string") return NextResponse.json({ error: "`content` (the file text) is required." }, { status: 400 });

  const p = resolveContentPath(body.path, process.cwd());
  if (!p.ok) return NextResponse.json({ error: p.error }, { status: p.status });
  const dryRun = body.dryRun === true;
  const text = body.content.endsWith("\n") ? body.content : `${body.content}\n`;
  const { info, issues, records } = validateContentFile(p.rel, text, process.cwd());
  const errors = issues.filter((i) => i.level === "error");

  if (errors.length) {
    return NextResponse.json({ ok: false, dryRun, path: p.rel, info, records, issues, error: `Validation failed with ${errors.length} error(s). Nothing was written.` }, { status: 422 });
  }
  if (dryRun) return NextResponse.json({ ok: true, dryRun: true, path: p.rel, info, records, issues });

  if (!info.writable) return NextResponse.json({ ok: false, path: p.rel, info, issues, error: info.readOnlyReason ?? "This file cannot be saved from the browser." }, { status: 403 });

  const freezeReason = typeof body.freezeReason === "string" ? body.freezeReason.trim() : "";
  if (info.frozen && !freezeReason) {
    return NextResponse.json(
      {
        ok: false,
        path: p.rel,
        info,
        issues,
        requiresFreezeReason: true,
        error: "Official PYQ files are frozen. Give a freeze reason (what was wrong and how it was checked against the official paper) to save this change.",
      },
      { status: 409 },
    );
  }

  const current = fs.readFileSync(p.abs);
  const currentSha = sha256(current);
  if (body.force !== true && typeof body.baseSha256 === "string" && body.baseSha256 !== currentSha) {
    return NextResponse.json(
      { ok: false, path: p.rel, info, issues, conflict: true, currentSha256: currentSha, error: "The file changed on disk after you opened it (another process may be writing it). Reload to see the latest version, or save anyway to overwrite it." },
      { status: 409 },
    );
  }
  if (Buffer.byteLength(text) > MAX_BYTES) return NextResponse.json({ error: "The file is too large to save from the browser." }, { status: 413 });

  // Atomic write: a temp file in the same directory, then rename over the original.
  const tmp = path.join(path.dirname(p.abs), `.${path.basename(p.abs)}.admin-${process.pid}-${Date.now()}.tmp`);
  try {
    fs.writeFileSync(tmp, text, { flag: "wx", mode: fs.statSync(p.abs).mode & 0o777 });
    fs.renameSync(tmp, p.abs);
  } catch (e) {
    try {
      fs.rmSync(tmp, { force: true });
    } catch {
      /* ignore */
    }
    return NextResponse.json({ ok: false, error: `Write failed: ${(e as Error).message}` }, { status: 500 });
  }
  const reminders = info.frozen ? info.reminders.map((r) => r.replace("<the same reason>", freezeReason.replace(/"/g, "'"))) : info.reminders;
  return NextResponse.json({ ok: true, path: p.rel, info, records, issues, sha256: sha256(text), unchanged: currentSha === sha256(text), reminders, freezeReason: freezeReason || undefined });
}
