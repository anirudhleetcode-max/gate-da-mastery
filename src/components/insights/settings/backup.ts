/**
 * Backup-file checks done before `importAll` replaces the active database:
 * envelope, table shapes, primary keys and duplicates. Pure (no Dexie), so it
 * is unit-tested and gives the student a precise reason when a file is rejected.
 */
import { BACKUP_VERSION } from "@/lib/userdata/ops";
import { localDay } from "@/lib/userdata/db";
import { DEMO_INFO_KEY } from "@/lib/demo/seed";

export const BACKUP_TABLES = ["attempts", "mockAttempts", "bookmarks", "revisionItems", "errorLogs", "roadmap", "settings", "views"] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

/** Singular and plural label of each table's records. */
export const TABLE_LABEL: Record<BackupTable, [one: string, many: string]> = {
  attempts: ["question attempt", "question attempts"],
  mockAttempts: ["mock attempt", "mock attempts"],
  bookmarks: ["bookmark", "bookmarks"],
  revisionItems: ["revision item", "revision items"],
  errorLogs: ["error-log entry", "error-log entries"],
  roadmap: ["roadmap stage", "roadmap stages"],
  settings: ["setting", "settings"],
  views: ["viewed page", "viewed pages"],
};

/** "1 question attempt", "3 bookmarks". */
export function tableCount(t: BackupTable, n: number): string {
  return `${n} ${TABLE_LABEL[t][n === 1 ? 0 : 1]}`;
}

/** Primary key of each table and whether it must be present in every row. */
const KEYS: Record<BackupTable, { field: string; type: "string" | "number"; required: boolean }> = {
  attempts: { field: "id", type: "number", required: false },
  mockAttempts: { field: "id", type: "string", required: true },
  bookmarks: { field: "key", type: "string", required: true },
  revisionItems: { field: "key", type: "string", required: true },
  errorLogs: { field: "id", type: "number", required: false },
  roadmap: { field: "stageId", type: "string", required: true },
  settings: { field: "key", type: "string", required: true },
  views: { field: "key", type: "string", required: true },
};

/** Fields a row needs so the app can use it (beyond the primary key). */
const REQUIRED: Partial<Record<BackupTable, string[]>> = {
  attempts: ["questionId", "status", "createdAt"],
  mockAttempts: ["testId", "status", "startedAt"],
  revisionItems: ["refId", "nextReview"],
  errorLogs: ["questionId", "createdAt"],
};

/** Settings key written by the demo generator: its presence marks a backup of the demo database. */
export const DEMO_MARKER_KEY = DEMO_INFO_KEY;

export interface BackupSummary {
  exportedAt: string | null;
  version: number;
  counts: Record<BackupTable, number>;
  /** The file was exported from the demo database. */
  fromDemo: boolean;
}

export type BackupCheck = { ok: true; summary: BackupSummary; data: Record<string, unknown> } | { ok: false; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function checkBackup(data: unknown): BackupCheck {
  const errors: string[] = [];
  if (!isObj(data)) return { ok: false, errors: ["The file does not contain a JSON object, so it is not a GATE DA Mastery backup."] };
  if (data.app !== "gate-da-mastery") return { ok: false, errors: ["This is not a GATE DA Mastery backup (the \"app\" field is missing or different)."] };
  if (typeof data.version !== "number") return { ok: false, errors: ["The backup has no version number."] };
  if (data.version > BACKUP_VERSION) return { ok: false, errors: [`This backup was made by a newer version of the app (format ${data.version}; this app reads up to ${BACKUP_VERSION}).`] };

  const counts = Object.fromEntries(BACKUP_TABLES.map((t) => [t, 0])) as Record<BackupTable, number>;
  for (const t of BACKUP_TABLES) {
    const rows = data[t];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) {
      errors.push(`“${t}” should be a list, but it is ${rows === null ? "null" : typeof rows}.`);
      continue;
    }
    counts[t] = rows.length;
    const { field, type, required } = KEYS[t];
    const seen = new Set<unknown>();
    for (const [i, row] of rows.entries()) {
      if (!isObj(row)) {
        errors.push(`${t}[${i}] is not an object.`);
        break;
      }
      const key = row[field];
      if (key === undefined) {
        if (required) {
          errors.push(`${t}[${i}] has no “${field}”.`);
          break;
        }
      } else if (typeof key !== type) {
        errors.push(`${t}[${i}].${field} should be a ${type}.`);
        break;
      } else if (seen.has(key)) {
        errors.push(`${t} contains the same ${field} twice (${String(key)}).`);
        break;
      } else seen.add(key);
      const missing = (REQUIRED[t] ?? []).filter((f) => row[f] === undefined);
      if (missing.length) {
        errors.push(`${t}[${i}] is missing ${missing.join(", ")}.`);
        break;
      }
    }
    if (errors.length >= 8) break;
  }
  if (errors.length) return { ok: false, errors };
  const settings = Array.isArray(data.settings) ? (data.settings as Record<string, unknown>[]) : [];
  return {
    ok: true,
    data,
    summary: {
      exportedAt: typeof data.exportedAt === "string" ? data.exportedAt : null,
      version: data.version,
      counts,
      fromDemo: settings.some((s) => s.key === DEMO_MARKER_KEY),
    },
  };
}

/** Parse the text of a chosen file; JSON errors become a readable message. */
export function parseBackupText(text: string): BackupCheck {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`The file is not valid JSON (${(e as Error).message}).`] };
  }
  return checkBackup(data);
}

export function backupFileName(demo: boolean, now: Date = new Date()): string {
  return `gate-da-${demo ? "demo-" : ""}backup-${localDay(now)}.json`;
}
