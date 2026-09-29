/**
 * Filterable, paginated question table for /admin. Filters live in the URL
 * (?origin=&subject=&verification=&review=&test=&q=&page=), so the table
 * works without client JavaScript and every view can be linked.
 */
import Form from "next/form";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Eye, ExternalLink, FilePen } from "lucide-react";
import type { QuestionOrigin, VerificationStatus } from "@/lib/content/schema";
import { OriginBadge, VerificationBadge } from "@/components/question/badges";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ORIGIN_LABEL, VERIFICATION_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { ORIGINS, REVIEW_STATUSES, VERIFICATIONS, editHref, type AdminRow, type ReviewStatus } from "./data";
import { REVIEW_LABEL, ReviewBadge, TableWrap, td, th } from "./parts";

export const PAGE_SIZE = 50;

export interface AdminFilters {
  origin?: QuestionOrigin;
  subject?: string;
  verification?: VerificationStatus;
  review?: ReviewStatus;
  test?: string;
  q?: string;
  page: number;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseFilters(sp: Record<string, string | string[] | undefined>): AdminFilters {
  const origin = one(sp.origin);
  const verification = one(sp.verification);
  const review = one(sp.review);
  const page = Number.parseInt(one(sp.page), 10);
  return {
    origin: (ORIGINS as string[]).includes(origin) ? (origin as QuestionOrigin) : undefined,
    subject: /^[a-z]{2,4}$/.test(one(sp.subject)) ? one(sp.subject) : undefined,
    verification: (VERIFICATIONS as string[]).includes(verification) ? (verification as VerificationStatus) : undefined,
    review: (REVIEW_STATUSES as string[]).includes(review) ? (review as ReviewStatus) : undefined,
    test: /^mock-\d{2}$/.test(one(sp.test)) ? one(sp.test) : undefined,
    q: one(sp.q).trim().slice(0, 80) || undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export function applyFilters(rows: AdminRow[], f: AdminFilters): AdminRow[] {
  const q = f.q?.toLowerCase();
  return rows.filter(
    (r) =>
      (!f.origin || r.origin === f.origin) &&
      (!f.subject || r.subjectId === f.subject) &&
      (!f.verification || r.verification === f.verification) &&
      (!f.review || r.reviewStatus === f.review) &&
      (!f.test || r.testId === f.test) &&
      (!q || r.id.toLowerCase().includes(q) || r.topicId.includes(q) || r.preview.toLowerCase().includes(q)),
  );
}

function hrefWith(f: AdminFilters, patch: Partial<AdminFilters>): string {
  const next = { ...f, ...patch };
  const p = new URLSearchParams();
  for (const k of ["origin", "subject", "verification", "review", "test", "q"] as const) if (next[k]) p.set(k, String(next[k]));
  if (next.page > 1) p.set("page", String(next.page));
  const s = p.toString();
  return `/admin${s ? `?${s}` : ""}#questions`;
}

export function QuestionTable({
  rows,
  subjects,
  filters,
  mocks,
  files,
}: {
  rows: AdminRow[];
  subjects: { id: string; name: string }[];
  filters: AdminFilters;
  mocks: { id: string; number: number }[];
  files: Map<string, string>;
}) {
  const filtered = applyFilters(rows, filters).sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(filters.page, pages);
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
  const active = Boolean(filters.origin || filters.subject || filters.verification || filters.review || filters.test || filters.q);

  return (
    <div>
      <Form action="/admin" scroll={false} className="grid grid-cols-2 gap-3 border-b border-border px-4 py-3 sm:grid-cols-3 sm:px-5 lg:grid-cols-7">
        <Select label="Origin" name="origin" id="f-origin" defaultValue={filters.origin ?? ""}>
          <option value="">All origins</option>
          {ORIGINS.map((o) => (
            <option key={o} value={o}>
              {ORIGIN_LABEL[o]}
            </option>
          ))}
        </Select>
        <Select label="Subject" name="subject" id="f-subject" defaultValue={filters.subject ?? ""}>
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select label="Verification" name="verification" id="f-verification" defaultValue={filters.verification ?? ""}>
          <option value="">Any</option>
          {VERIFICATIONS.map((v) => (
            <option key={v} value={v}>
              {VERIFICATION_LABEL[v]}
            </option>
          ))}
        </Select>
        <Select label="Review status" name="review" id="f-review" defaultValue={filters.review ?? ""}>
          <option value="">Any</option>
          {REVIEW_STATUSES.map((s) => (
            <option key={s} value={s}>
              {REVIEW_LABEL[s]}
            </option>
          ))}
        </Select>
        <Select label="Mock test" name="test" id="f-test" defaultValue={filters.test ?? ""}>
          <option value="">Any</option>
          {mocks.map((m) => (
            <option key={m.id} value={m.id}>
              Mock {m.number}
            </option>
          ))}
        </Select>
        <label htmlFor="f-q" className="flex min-w-0 flex-col gap-1 text-xs font-medium text-fg-3">
          ID, topic or text
          <input id="f-q" name="q" type="search" defaultValue={filters.q ?? ""} placeholder="e.g. M07 or eigen" className="h-9 min-w-0 rounded-lg border border-border bg-surface px-2.5 text-sm text-fg placeholder:text-fg-3" />
        </label>
        <div className="col-span-2 flex items-end gap-2 sm:col-span-3 lg:col-span-1">
          <Button type="submit" variant="primary" className="h-9 flex-1">
            Apply
          </Button>
          {active ? (
            <Link href="/admin#questions" className="inline-flex h-9 items-center rounded-lg px-2 text-sm font-medium text-fg-2 hover:bg-surface-2 hover:text-fg">
              Clear
            </Link>
          ) : null}
        </div>
      </Form>

      <p role="status" className="px-4 py-2 text-sm text-fg-3 sm:px-5">
        {filtered.length === rows.length ? `${rows.length} questions` : `${filtered.length} of ${rows.length} questions match`}
        {pages > 1 ? ` · page ${page} of ${pages}` : ""}
      </p>

      {shown.length === 0 ? (
        <div className="px-4 pb-4 sm:px-5">
          <EmptyState title="No questions match these filters" action={<Link href="/admin#questions" className="text-sm font-medium text-accent-text hover:underline">Clear filters</Link>}>
            Try removing a filter. Review status applies only to original (mock and practice) questions.
          </EmptyState>
        </div>
      ) : (
        <TableWrap label="Questions">
          <table className="w-full text-sm">
            <caption className="sr-only">Questions matching the filters</caption>
            <thead>
              <tr className="border-y border-border bg-surface-2">
                <th scope="col" className={th}>
                  Question
                </th>
                <th scope="col" className={th}>
                  Origin
                </th>
                <th scope="col" className={th}>
                  Subject · topic
                </th>
                <th scope="col" className={th}>
                  Status
                </th>
                <th scope="col" className={th}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const file = files.get(r.id);
                return (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <th scope="row" className={cn(td, "min-w-56 max-w-md text-left font-normal")}>
                      <span className="font-mono text-[0.8rem] font-semibold text-fg">{r.id}</span>
                      <span className="ml-2 text-xs text-fg-3">
                        {r.type} · {r.marks}m
                      </span>
                      <span className="mt-0.5 line-clamp-2 text-xs text-fg-3">{r.preview}</span>
                    </th>
                    <td className={td}>
                      <OriginBadge origin={r.origin} />
                    </td>
                    <td className={cn(td, "min-w-40 text-fg-2")}>
                      <span className="block">{subjectName.get(r.subjectId) ?? r.subjectId}</span>
                      <span className="block text-xs text-fg-3">{r.topicId}</span>
                    </td>
                    <td className={cn(td, "min-w-36")}>
                      <span className="flex flex-wrap gap-1">
                        <VerificationBadge status={r.verification} />
                        {r.reviewStatus ? <ReviewBadge status={r.reviewStatus} /> : null}
                        {r.dispute ? <span className="text-xs font-medium text-warning">Resolved dispute</span> : null}
                        {r.disagrees ? <span className="text-xs font-medium text-danger">Disagrees with key</span> : null}
                      </span>
                      <span className="mt-1 block text-xs text-fg-3">{r.servable ? "Visible to students" : "Hidden by the availability gate"}</span>
                    </td>
                    <td className={cn(td, "min-w-40")}>
                      <span className="flex flex-wrap gap-x-3 gap-y-1">
                        <Link href={`/admin/question/${encodeURIComponent(r.id)}`} className="inline-flex items-center gap-1 font-medium text-accent-text hover:underline">
                          <Eye aria-hidden className="h-3.5 w-3.5" /> Preview<span className="sr-only"> {r.id}</span>
                        </Link>
                        {file ? (
                          <Link href={editHref(file)} className="inline-flex items-center gap-1 font-medium text-accent-text hover:underline">
                            <FilePen aria-hidden className="h-3.5 w-3.5" /> Edit file<span className="sr-only"> for {r.id}</span>
                          </Link>
                        ) : null}
                        {r.servable ? (
                          <Link href={`/questions/${encodeURIComponent(r.id)}`} className="inline-flex items-center gap-1 text-fg-2 hover:underline">
                            <ExternalLink aria-hidden className="h-3.5 w-3.5" /> Student view<span className="sr-only"> of {r.id}</span>
                          </Link>
                        ) : null}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      )}

      {pages > 1 ? (
        <nav aria-label="Question table pages" className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm sm:px-5">
          {page > 1 ? (
            <Link href={hrefWith(filters, { page: page - 1 })} className="inline-flex min-h-10 items-center gap-1 font-medium text-accent-text hover:underline">
              <ChevronLeft aria-hidden className="h-4 w-4" /> Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="tnum text-fg-3">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={hrefWith(filters, { page: page + 1 })} className="inline-flex min-h-10 items-center gap-1 font-medium text-accent-text hover:underline">
              Next <ChevronRight aria-hidden className="h-4 w-4" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
