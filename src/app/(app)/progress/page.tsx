import type { Metadata } from "next";
import { getCatalog, getMocks } from "@/lib/server/repo";
import { shortTitle } from "@/lib/mock/structure";
import { PageHeader } from "@/components/ui/PageHeader";
import type { MockInfo } from "@/components/dashboard/mocks";
import { ProgressClient } from "./ProgressClient";

export const metadata: Metadata = {
  title: "Progress analytics",
  description: "Your GATE DA learning analytics: score and accuracy trends, subject and topic performance, time per question, completion and weak-area trend.",
};

export default function ProgressPage() {
  const catalog = getCatalog();
  const mocks: MockInfo[] = getMocks().map((m) => ({
    id: m.id,
    number: m.number,
    tier: m.tier,
    shortTitle: shortTitle(m.title),
    available: m.available,
    durationMinutes: m.durationMinutes,
  }));
  return (
    <>
      <PageHeader
        title="Progress"
        description="Trends and breakdowns computed on this device from your own attempts. They are learning analytics to guide your study, not official GATE metrics, and they never predict a GATE score or rank."
      />
      <ProgressClient catalog={catalog} mocks={mocks} />
    </>
  );
}
