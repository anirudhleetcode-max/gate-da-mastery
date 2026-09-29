"use client";
/**
 * One error-log entry, editable in place: mistake type, correct concept,
 * note (saved on blur) and revision status, all through updateErrorLog.
 * Rendered as a card on phones, tablets and narrow laptops, and as a two-row table body on wide screens.
 */
import Link from "next/link";
import type { ErrorLogRow, MistakeType } from "@/lib/userdata/db";
import { MISTAKE_LABELS, MISTAKE_TYPES } from "@/lib/userdata/db";
import { useUserData } from "@/lib/userdata/hooks";
import { updateErrorLog } from "@/lib/userdata/ops";
import { OriginBadge } from "@/components/question/badges";
import { SUBJECT_SHORT } from "@/lib/labels";
import { cn, formatDate } from "@/lib/utils";
import { BlurField, SelectField } from "./fields";
import { dayOf, isWithdrawnMockQuestion, questionHref } from "./shared";

export type RevisionStatus = ErrorLogRow["revisionStatus"];
export const STATUS_LABEL: Record<RevisionStatus, string> = { open: "Open", revising: "Revising", resolved: "Resolved" };
export const STATUSES: RevisionStatus[] = ["open", "revising", "resolved"];

export interface EntryContext {
  topicName: ReadonlyMap<string, string>;
  availableMocks: ReadonlySet<string>;
  /** id of a <datalist> with concept suggestions. */
  conceptListId: string;
}

function useSave(entry: ErrorLogRow) {
  const { db } = useUserData();
  return {
    canEdit: Boolean(db) && entry.id !== undefined,
    save: async (patch: Parameters<typeof updateErrorLog>[2]) => {
      if (!db || entry.id === undefined) return;
      await updateErrorLog(db, entry.id, patch);
    },
  };
}

const MISTAKE_OPTIONS: { value: MistakeType | ""; label: string }[] = [{ value: "", label: "Not classified" }, ...MISTAKE_TYPES.map((m) => ({ value: m, label: MISTAKE_LABELS[m] }))];
const STATUS_OPTIONS = STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }));

function QuestionCell({ entry, ctx }: { entry: ErrorLogRow; ctx: EntryContext }) {
  const withdrawn = isWithdrawnMockQuestion(entry.questionId, ctx.availableMocks);
  const topic = ctx.topicName.get(entry.topicId) ?? entry.topicId;
  return (
    <div className="min-w-0 space-y-1">
      <OriginBadge origin={entry.origin} />
      <div>
        {withdrawn ? (
          <span className="font-medium text-fg">{entry.title}</span>
        ) : (
          <Link href={questionHref(entry.questionId)} className="break-words font-medium text-fg hover:underline">
            {entry.title}
          </Link>
        )}
      </div>
      <p className="text-xs text-fg-3">
        {SUBJECT_SHORT[entry.subjectId] ?? entry.subjectId} · {topic}
      </p>
      {withdrawn ? <p className="text-xs text-warning">Temporarily unavailable while its mock test is re-verified.</p> : null}
    </div>
  );
}

function Answers({ entry, stacked = false }: { entry: ErrorLogRow; stacked?: boolean }) {
  return (
    <dl className={cn("grid gap-x-3 gap-y-0.5 text-sm", stacked ? "grid-cols-1" : "grid-cols-2")}>
      <div className="min-w-0">
        <dt className="text-xs text-fg-3">Your answer</dt>
        <dd className="tnum break-words font-semibold text-danger">{entry.yourAnswer || "—"}</dd>
      </div>
      <div className="min-w-0">
        <dt className="text-xs text-fg-3">Correct answer</dt>
        <dd className="tnum break-words font-semibold text-success">{entry.correctAnswer || "—"}</dd>
      </div>
    </dl>
  );
}

function dates(entry: ErrorLogRow) {
  const created = dayOf(entry.createdAt);
  const updated = dayOf(entry.updatedAt);
  return { created: formatDate(created), updated: updated !== created ? formatDate(updated) : null };
}

/** Card layout (phones and tablets): one column, two from md up. */
export function ErrorCard({ entry, ctx }: { entry: ErrorLogRow; ctx: EntryContext }) {
  const { canEdit, save } = useSave(entry);
  const p = `m-${entry.id}`;
  const d = dates(entry);
  return (
    <li className="grid gap-x-6 gap-y-3 rounded-[var(--radius)] border border-border bg-surface p-4 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="min-w-0 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <QuestionCell entry={entry} ctx={ctx} />
          <p className="shrink-0 text-right text-xs text-fg-3">
            <time dateTime={entry.createdAt}>{d.created}</time>
            {d.updated ? <span className="block">edited {d.updated}</span> : null}
          </p>
        </div>
        <Answers entry={entry} />
      </div>
      <div className="min-w-0 space-y-3">
        <div className="grid gap-3 min-[360px]:grid-cols-2">
          <SelectField id={`${p}-type`} label="Mistake type" srContext={entry.title} value={entry.mistakeType ?? ""} options={MISTAKE_OPTIONS} disabled={!canEdit} onSave={(v) => save({ mistakeType: v || null })} />
          <SelectField id={`${p}-status`} label="Revision status" srContext={entry.title} value={entry.revisionStatus} options={STATUS_OPTIONS} disabled={!canEdit} onSave={(v) => save({ revisionStatus: v })} />
        </div>
        <BlurField id={`${p}-concept`} label="Correct concept" srContext={entry.title} value={entry.correctConcept} list={ctx.conceptListId} disabled={!canEdit} placeholder="What the question tests" onSave={(v) => save({ correctConcept: v })} />
        <BlurField id={`${p}-note`} label="Your note" srContext={entry.title} value={entry.note} multiline disabled={!canEdit} placeholder="What will you do differently next time?" onSave={(v) => save({ note: v })} />
      </div>
    </li>
  );
}

/** Table layout (wide screens): a <tbody> of two rows per entry. */
export function ErrorTableBody({ entry, ctx }: { entry: ErrorLogRow; ctx: EntryContext }) {
  const { canEdit, save } = useSave(entry);
  const p = `t-${entry.id}`;
  const d = dates(entry);
  return (
    <tbody className="border-b border-border last:border-0">
      <tr className="align-top">
        <td className="px-3 pb-2 pt-3">
          <QuestionCell entry={entry} ctx={ctx} />
        </td>
        <td className="px-3 pb-2 pt-3">
          <Answers entry={entry} stacked />
        </td>
        <td className="px-3 pb-2 pt-3">
          <SelectField id={`${p}-type`} label={`Mistake type for ${entry.title}`} srOnlyLabel value={entry.mistakeType ?? ""} options={MISTAKE_OPTIONS} disabled={!canEdit} onSave={(v) => save({ mistakeType: v || null })} />
        </td>
        <td className="px-3 pb-2 pt-3">
          <SelectField id={`${p}-status`} label={`Revision status for ${entry.title}`} srOnlyLabel value={entry.revisionStatus} options={STATUS_OPTIONS} disabled={!canEdit} onSave={(v) => save({ revisionStatus: v })} />
        </td>
        <td className="whitespace-nowrap px-3 pb-2 pt-3 text-right text-xs text-fg-3">
          <time dateTime={entry.createdAt}>{d.created}</time>
          {d.updated ? <span className="block">edited {d.updated}</span> : null}
        </td>
      </tr>
      <tr>
        <td colSpan={5} className="px-3 pb-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <BlurField id={`${p}-concept`} label="Correct concept" srContext={entry.title} value={entry.correctConcept} list={ctx.conceptListId} disabled={!canEdit} placeholder="What the question tests" onSave={(v) => save({ correctConcept: v })} />
            <BlurField id={`${p}-note`} label="Your note" srContext={entry.title} value={entry.note} multiline disabled={!canEdit} placeholder="What will you do differently next time?" onSave={(v) => save({ note: v })} />
          </div>
        </td>
      </tr>
    </tbody>
  );
}
