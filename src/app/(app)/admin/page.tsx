import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { FileJson, Wrench } from "lucide-react";
import { getBundle, getSubjects } from "@/lib/server/repo";
import { PageHeader } from "@/components/ui/PageHeader";
import { Callout } from "@/components/ui/Callout";
import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { ButtonLink } from "@/components/ui/Button";
import { isAdminEnabled } from "@/components/insights/admin/access";
import { adminRows, questionFileIndex } from "@/components/insights/admin/data";
import { Section } from "@/components/insights/admin/parts";
import { InventoryTables, MockAvailabilityTable, ValidationIssues } from "@/components/insights/admin/Inventory";
import { QuestionTable, parseFilters } from "@/components/insights/admin/QuestionTable";
import { formatDate, plural } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Content management",
  robots: { index: false, follow: false },
};

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminPage({ searchParams }: { searchParams: Search }) {
  await connection();
  if (!isAdminEnabled()) notFound();
  const sp = await searchParams;
  const bundle = getBundle();
  const rows = adminRows();
  const subjects = getSubjects().map((s) => ({ id: s.id, name: s.shortName }));
  const filters = parseFilters(sp);
  const fileIndex = questionFileIndex();

  const count = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).length;
  const planned = bundle.mocks.reduce((a, m) => a + m.questionIds.length, 0);
  const errors = bundle.issues.filter((i) => i.level === "error").length;
  const warnings = bundle.issues.length - errors;
  const why = process.env.ADMIN_ENABLED === "true" ? "ADMIN_ENABLED=true" : "the development server";

  return (
    <>
      <PageHeader
        title="Content management"
        crumbs={[{ label: "Admin" }]}
        description={
          <>
            Inventory, review status and raw-file editing for everything in <code className="font-mono text-sm">content/</code>. Enabled by {why}; it answers 404 in production unless{" "}
            <code className="font-mono text-sm">ADMIN_ENABLED=true</code>.
          </>
        }
        actions={
          <ButtonLink href="/admin/edit" variant="secondary">
            <FileJson aria-hidden className="h-4 w-4" /> Content files
          </ButtonLink>
        }
      />

      <div className="space-y-8">
        <Callout tone="info" title={`Content bundle built ${formatDate(bundle.builtAt)} at ${bundle.builtAt.slice(11, 16)} UTC (version ${bundle.version.slice(0, 8)})`}>
          This page reads the compiled bundle, including questions the availability gate hides from students. After editing a file, run{" "}
          <code className="font-mono">npm run content:build</code> (and <code className="font-mono">npm run content:mock-review</code> for mock or practice files), then restart the server to see the change here.
        </Callout>

        <nav aria-label="On this page" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {[
            ["inventory", "Inventory"],
            ["mocks", "Mock availability"],
            ["issues", "Validation issues"],
            ["questions", "Questions"],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="font-medium text-accent-text hover:underline">
              {label}
            </a>
          ))}
        </nav>

        <Section id="inventory" title="Inventory" description="Counts over every compiled question. “Visible” means the question passes the availability gate and students can open it.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Questions" value={rows.length} hint={`${count((r) => r.servable)} visible to students`} />
            <Stat label="Official PYQs" value={count((r) => r.origin === "OFFICIAL_PYQ")} hint={plural(bundle.papers.length, "paper")} />
            <Stat label="Mock questions" value={count((r) => r.origin === "MOCK_TEST")} hint={`of ${planned} planned`} />
            <Stat label="Practice" value={count((r) => r.origin === "ORIGINAL_PRACTICE")} hint={`${count((r) => r.origin === "ORIGINAL_PRACTICE" && r.servable)} visible`} />
            <Stat label="Available mocks" value={`${bundle.mocks.filter((m) => m.available).length}/${bundle.mocks.length}`} hint="every question verified" />
            <Stat label="Build issues" value={errors} hint={`${plural(warnings, "warning")}`} />
          </div>
          <InventoryTables rows={rows} subjects={subjects} learning={{ concepts: bundle.concepts.length, formulas: bundle.formulas.length, strategy: bundle.strategy.length, roadmap: bundle.roadmap.length, sources: bundle.sources.length, papers: bundle.papers.length }} />
        </Section>

        <Section id="mocks" title="Mock availability" description="A mock opens to students only when every planned question is present and VERIFIED.">
          <MockAvailabilityTable mocks={bundle.mocks} rows={rows} />
        </Section>

        <Section id="issues" title="Validation issues" description={`From the latest content build (${formatDate(bundle.builtAt)}). Errors block a strict production build.`}>
          <ValidationIssues issues={bundle.issues} />
        </Section>

        <Section id="questions" title="Questions" description="Filter every compiled question. Preview shows unverified questions to you only; nothing you do here is recorded as an attempt.">
          <Card>
            <QuestionTable rows={rows} subjects={subjects} filters={filters} mocks={bundle.mocks.map((m) => ({ id: m.id, number: m.number }))} files={fileIndex} />
          </Card>
        </Section>

        <p className="flex items-center gap-2 text-sm text-fg-3">
          <Wrench aria-hidden className="h-4 w-4" />
          Command-line equivalents: <code className="font-mono">npm run content:validate</code>, <code className="font-mono">npm run content:audit</code>,{" "}
          <Link href="/sources" className="text-accent-text hover:underline">
            Sources &amp; methodology
          </Link>
        </p>
      </div>
    </>
  );
}
