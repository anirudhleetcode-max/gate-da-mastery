import type { Metadata } from "next";
import Link from "next/link";
import { getMockQuestions, getMocks } from "@/lib/server/repo";
import { TIER_LABEL, TIER_RANGE } from "@/lib/labels";
import { TIER_EXPLANATION, TIER_ORDER, toSummary } from "@/lib/mock/structure";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { MockLabel } from "@/components/mock/MockLabel";
import { MockList, type TierGroup } from "@/components/mock/MockList";

export const metadata: Metadata = {
  title: "Mock tests",
  description: "50 progressive, timed GATE DA mock tests with a CBT-style exam interface and detailed results analysis.",
};

export default function MocksPage() {
  const mocks = getMocks();
  const tiers: TierGroup[] = TIER_ORDER.map((tier) => ({
    tier,
    label: TIER_LABEL[tier],
    range: TIER_RANGE[tier],
    explanation: TIER_EXPLANATION[tier],
    mocks: mocks
      .filter((m) => m.tier === tier)
      .sort((a, b) => a.number - b.number)
      .map((m) => toSummary(m, getMockQuestions(m.id))),
  })).filter((t) => t.mocks.length);

  return (
    <>
      <PageHeader
        title="Mock tests"
        description="Timed tests in a GATE-style exam interface, arranged as a progression: start with short subject-wise foundations and finish with full 3-hour simulations of the DA paper."
      />
      <MockLabel className="mb-5" />

      {tiers.length ? (
        <>
          <nav aria-label="Mock tiers" className="mb-8">
            <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {tiers.map((t, i) => (
                <li key={t.tier}>
                  <Link href={`#tier-${t.tier.toLowerCase()}`} className="flex h-full min-h-11 flex-col rounded-[var(--radius)] border border-border bg-surface px-3 py-2 hover:border-border-strong hover:bg-surface-2">
                    <span className="text-xs font-medium text-fg-3">
                      Step {i + 1} · {t.range}
                    </span>
                    <span className="text-sm font-semibold text-fg">{t.label}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
          <MockList tiers={tiers} />
        </>
      ) : (
        <EmptyState
          title="No mock tests are published yet"
          action={
            <ButtonLink href="/pyqs" variant="primary" className="text-surface">
              Practise official PYQs
            </ButtonLink>
          }
        >
          The mock-test definitions are not in this build yet. Meanwhile, practise official questions from previous GATE DA papers.
        </EmptyState>
      )}
    </>
  );
}
