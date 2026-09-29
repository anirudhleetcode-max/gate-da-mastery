import type { Metadata } from "next";
import { getCatalog, getConcepts, getFormulas, getMocks, getPapers, getPattern, getRoadmap } from "@/lib/server/repo";
import { shortTitle } from "@/lib/mock/structure";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { DashboardClient, type ExamContext, type LibraryCounts } from "@/components/dashboard/DashboardClient";
import type { MockInfo } from "@/components/dashboard/mocks";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your GATE DA preparation at a glance: progress, weak areas, revision due, mock performance and what to do next.",
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** First date in a provisional-dates fact such as "February 6, 7, 13, 14, 20 and 21, 2027; …" → "2027-02-06". */
function firstDate(text: string): string | null {
  const m = text.match(new RegExp(`(${MONTHS.join("|")})\\s+(\\d{1,2})\\b`));
  const y = text.match(/\b(20\d{2})\b/);
  if (!m || !y) return null;
  return `${y[1]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

export default function DashboardPage() {
  const catalog = getCatalog();
  const papers = getPapers();
  const pattern = getPattern();
  const fact = (id: string) => pattern?.facts.find((f) => f.id === id);
  const institute = fact("gate2027-institute");
  const dates = fact("gate2027-dates");
  const exam: ExamContext = {
    institute: institute?.value ?? null,
    dates: dates ? dates.value.split(";")[0].trim() : null,
    firstDate: dates ? firstDate(dates.value) : null,
    datesNote: dates?.notes ?? null,
  };
  const mocks: MockInfo[] = getMocks().map((m) => ({
    id: m.id,
    number: m.number,
    tier: m.tier,
    shortTitle: shortTitle(m.title),
    available: m.available,
    durationMinutes: m.durationMinutes,
  }));
  const years = [...new Set(papers.map((p) => p.year))].sort((a, b) => a - b);
  const library: LibraryCounts = {
    papers: papers.length,
    years: years.length ? (years.length > 1 ? `${years[0]}–${years[years.length - 1]}` : String(years[0])) : "",
    officialQuestions: papers.reduce((a, p) => a + p.totalQuestions, 0),
    concepts: getConcepts().length,
    formulas: getFormulas().length,
    roadmapStages: getRoadmap().length,
  };

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          exam.institute || exam.dates ? (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="font-medium text-fg">GATE 2027</span>
              {exam.institute ? (
                <>
                  <span aria-hidden className="text-fg-3">·</span>
                  <span>Organizing institute: {exam.institute}</span>
                </>
              ) : null}
              {exam.dates ? (
                <>
                  <span aria-hidden className="text-fg-3">·</span>
                  <span>
                    Exam dates: {exam.dates} <Badge tone="warning">Provisional</Badge>
                  </span>
                </>
              ) : null}
            </p>
          ) : (
            "Your GATE DA preparation at a glance."
          )
        }
      />
      <DashboardClient catalog={catalog} mocks={mocks} exam={exam} library={library} />
    </>
  );
}
