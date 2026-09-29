import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Preferences } from "@/components/insights/settings/Preferences";
import { DataManagement } from "@/components/insights/settings/DataManagement";
import { DemoMode } from "@/components/insights/settings/DemoMode";
import { demoMockChoice, demoPyqCount } from "@/components/insights/settings/demoPool";

export const metadata: Metadata = {
  title: "Settings & data",
  description: "Study preferences, backup and restore of your local progress, reset, and the separate demo mode.",
};

export default function SettingsPage() {
  // Demo data may reference only real, servable ids: official PYQs and questions of AVAILABLE mocks.
  // Only counts go into the page; the ids and answer keys are fetched from /settings/demo-pool on demand.
  const pyqCount = demoPyqCount();
  const mocks = demoMockChoice();

  return (
    <>
      <PageHeader
        title="Settings & data"
        crumbs={[{ label: "Settings & data" }]}
        description={
          <>
            Preferences, backups and demo mode. Your progress lives only in this browser; see{" "}
            <Link href="/sources" className="text-accent-text underline">
              Sources &amp; methodology
            </Link>{" "}
            for how content is verified.
          </>
        }
      />
      {/* Mobile order: preferences, your data, demo. Desktop: preferences + demo on the left, data on the right. */}
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <div className="lg:col-start-1 lg:row-start-1">
          <Preferences />
        </div>
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <DataManagement />
        </div>
        <div className="lg:col-start-1 lg:row-start-2">
          <DemoMode pyqCount={pyqCount} mocks={mocks} />
        </div>
      </div>
    </>
  );
}
