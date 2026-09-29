/** Inventory, mock-availability and validation-issue tables for /admin (server components). */
import Link from "next/link";
import { CircleAlert, TriangleAlert } from "lucide-react";
import type { ContentBundle, ContentIssue } from "@/lib/content/types";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/Progress";
import { EmptyState } from "@/components/ui/EmptyState";
import { OriginBadge } from "@/components/question/badges";
import { TIER_LABEL, VERIFICATION_LABEL } from "@/lib/labels";
import { ORIGINS, REVIEW_STATUSES, VERIFICATIONS, type AdminRow } from "./data";
import { Num, REVIEW_LABEL, TableWrap, td, tdNum, th } from "./parts";
import { cn } from "@/lib/utils";

/** Narrow status columns may wrap their header onto two lines. */
const thWrap = cn(th, "whitespace-normal px-2 text-right align-bottom");
const tdTight = cn(tdNum, "px-2");

export function InventoryTables({
  rows,
  subjects,
  learning,
}: {
  rows: AdminRow[];
  subjects: { id: string; name: string }[];
  learning: { concepts: number; formulas: number; strategy: number; roadmap: number; sources: number; papers: number };
}) {
  const n = (f: (r: AdminRow) => boolean) => rows.filter(f).length;
  const originals = ORIGINS.filter((o) => o !== "OFFICIAL_PYQ");
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
      <Card className="min-w-0">
        <CardHeader as="h3" title="By subject and origin" description="All compiled questions (visible or not)." />
        <TableWrap label="Questions by subject and origin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className={th}>
                  Subject
                </th>
                {ORIGINS.map((o) => (
                  <th key={o} scope="col" className={`${th} text-right`}>
                    {o === "OFFICIAL_PYQ" ? "PYQ" : o === "MOCK_TEST" ? "Mock" : "Practice"}
                  </th>
                ))}
                <th scope="col" className={`${th} text-right`}>
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <th scope="row" className={`${td} text-left font-medium text-fg-2`}>
                    <Link href={`/admin?subject=${s.id}#questions`} className="hover:underline">
                      {s.name}
                    </Link>
                  </th>
                  {ORIGINS.map((o) => (
                    <td key={o} className={tdNum}>
                      <Num n={n((r) => r.subjectId === s.id && r.origin === o)} />
                    </td>
                  ))}
                  <td className={`${tdNum} font-medium`}>{n((r) => r.subjectId === s.id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <div className="min-w-0 space-y-4">
        <Card>
          <CardHeader as="h3" title="Verification badge by origin" description="The weakest of source, transcription, answer and solution status." />
          <TableWrap label="Verification status by origin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className={th}>
                    Origin
                  </th>
                  {VERIFICATIONS.map((v) => (
                    <th key={v} scope="col" className={thWrap}>
                      {VERIFICATION_LABEL[v]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ORIGINS.map((o) => (
                  <tr key={o} className="border-b border-border last:border-0">
                    <th scope="row" className={`${td} text-left`}>
                      <OriginBadge origin={o} />
                    </th>
                    {VERIFICATIONS.map((v) => (
                      <td key={v} className={tdTight}>
                        <Link href={`/admin?origin=${o}&verification=${v}#questions`} className="hover:underline">
                          <Num n={n((r) => r.origin === o && r.verification === v)} />
                        </Link>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
        <Card>
          <CardHeader as="h3" title="Review pipeline (original questions)" description="DRAFT → SELF_CHECKED → blind re-solve + gates → VERIFIED | NEEDS_REVIEW." />
          <TableWrap label="Review status of original questions">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className={th}>
                    Origin
                  </th>
                  {REVIEW_STATUSES.map((s) => (
                    <th key={s} scope="col" className={thWrap}>
                      {REVIEW_LABEL[s]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {originals.map((o) => (
                  <tr key={o} className="border-b border-border last:border-0">
                    <th scope="row" className={`${td} text-left`}>
                      <OriginBadge origin={o} />
                    </th>
                    {REVIEW_STATUSES.map((s) => (
                      <td key={s} className={tdTight}>
                        <Link href={`/admin?origin=${o}&review=${s}#questions`} className="hover:underline">
                          <Num n={n((r) => r.origin === o && r.reviewStatus === s)} />
                        </Link>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
        <Card>
          <CardHeader as="h3" title="Learning content and facts" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 text-sm sm:grid-cols-3 sm:px-5">
            {(
              [
                ["Concepts", learning.concepts],
                ["Formulas", learning.formulas],
                ["Strategy articles", learning.strategy],
                ["Roadmap stages", learning.roadmap],
                ["Sources", learning.sources],
                ["Exam papers", learning.papers],
              ] as const
            ).map(([label, v]) => (
              <div key={label} className="flex items-baseline justify-between gap-2 border-b border-border pb-1">
                <dt className="text-fg-3">{label}</dt>
                <dd className="tnum font-medium">
                  <Num n={v} />
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </div>
  );
}

export function MockAvailabilityTable({ mocks, rows }: { mocks: ContentBundle["mocks"]; rows: AdminRow[] }) {
  if (!mocks.length) return <EmptyState title="No mock tests are defined">Add test definitions to content/mocks/tests.json.</EmptyState>;
  const byTest = new Map<string, AdminRow[]>();
  for (const r of rows) if (r.testId) (byTest.get(r.testId) ?? byTest.set(r.testId, []).get(r.testId)!).push(r);
  return (
    <Card>
      <TableWrap label="Mock availability">
        <table className="w-full text-sm">
          <caption className="sr-only">Per-mock availability: verified questions out of planned</caption>
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className={th}>
                Mock
              </th>
              <th scope="col" className={th}>
                Tier
              </th>
              <th scope="col" className={`${th} min-w-40`}>
                Verified / planned
              </th>
              <th scope="col" className={`${th} text-right`}>
                Present
              </th>
              <th scope="col" className={`${th} text-right`}>
                Self-checked
              </th>
              <th scope="col" className={`${th} text-right`}>
                Needs review
              </th>
              <th scope="col" className={th}>
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {mocks.map((m) => {
              const qs = byTest.get(m.id) ?? [];
              const planned = m.questionIds.length;
              const present = m.questionIds.filter((id) => qs.some((q) => q.id === id)).length;
              return (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <th scope="row" className={`${td} whitespace-nowrap text-left font-medium`}>
                    <Link href={`/admin?origin=MOCK_TEST&test=${m.id}#questions`} className="hover:underline">
                      Mock {m.number}
                    </Link>
                  </th>
                  <td className={`${td} whitespace-nowrap text-fg-2`}>{TIER_LABEL[m.tier]}</td>
                  <td className={td}>
                    <div className="flex items-center gap-2">
                      <ProgressBar value={m.verifiedCount} max={planned} label={`Mock ${m.number}: ${m.verifiedCount} of ${planned} verified`} tone={m.available ? "success" : "accent"} className="w-24" />
                      <span className="tnum whitespace-nowrap text-fg-2">
                        {m.verifiedCount}/{planned}
                      </span>
                    </div>
                  </td>
                  <td className={tdNum}>
                    <Num n={present} />
                  </td>
                  <td className={tdNum}>
                    <Num n={qs.filter((q) => q.reviewStatus === "SELF_CHECKED").length} />
                  </td>
                  <td className={tdNum}>
                    <Num n={qs.filter((q) => q.reviewStatus === "NEEDS_REVIEW").length} />
                  </td>
                  <td className={td}>
                    {m.available ? (
                      <Badge tone="success">Available</Badge>
                    ) : present === 0 ? (
                      <Badge tone="outline">Not started</Badge>
                    ) : present < planned ? (
                      <Badge tone="warning">Incomplete</Badge>
                    ) : (
                      <Badge tone="info">In review</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableWrap>
    </Card>
  );
}

export function ValidationIssues({ issues }: { issues: ContentIssue[] }) {
  if (!issues.length) {
    return (
      <EmptyState title="No validation issues">
        The latest content build reported no errors or warnings.
      </EmptyState>
    );
  }
  const sorted = [...issues].sort((a, b) => (a.level === b.level ? a.entity.localeCompare(b.entity, "en", { numeric: true }) : a.level === "error" ? -1 : 1));
  const first = sorted.slice(0, 40);
  const rest = sorted.slice(40);
  const Item = ({ i }: { i: ContentIssue }) => (
    <li className="flex gap-2.5 px-4 py-2 text-sm sm:px-5">
      {i.level === "error" ? <CircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-danger" /> : <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" />}
      <span className="min-w-0">
        <span className={i.level === "error" ? "font-semibold text-danger" : "font-semibold text-warning"}>{i.level === "error" ? "Error" : "Warning"}</span>{" "}
        <code className="break-all font-mono text-xs text-fg-2">{i.entity}</code> <span className="text-fg">{i.message}</span>
      </span>
    </li>
  );
  return (
    <Card>
      <ul className="divide-y divide-border">
        {first.map((i, k) => (
          <Item key={k} i={i} />
        ))}
      </ul>
      {rest.length ? (
        <details className="border-t border-border">
          <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-accent-text sm:px-5">Show {rest.length} more</summary>
          <ul className="divide-y divide-border">
            {rest.map((i, k) => (
              <Item key={k} i={i} />
            ))}
          </ul>
        </details>
      ) : null}
    </Card>
  );
}

