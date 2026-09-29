"use client";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import type { Catalog } from "@/lib/server/repo";
import { useProgressModel } from "@/lib/analytics/useProgress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { useDataStatus, useHashTab } from "./hooks";
import type { SubjectPageData } from "./types";
import { GoToTab, SUBJECT_TABS, type SubjectTab } from "./tabNav";
import { OverviewPanel } from "./panels/OverviewPanel";
import { TopicsPanel } from "./panels/TopicsPanel";
import { PyqsPanel } from "./panels/PyqsPanel";
import { PracticePanel } from "./panels/PracticePanel";
import { MockQuestionsPanel } from "./panels/MockQuestionsPanel";
import { WeakAreasPanel } from "./panels/WeakAreasPanel";
import { RevisionPanel } from "./panels/RevisionPanel";
import type { PanelProps } from "./panels/common";

const TAB_IDS = SUBJECT_TABS.map((t) => t.id);

const PANELS: Record<SubjectTab, (p: PanelProps) => ReactNode> = {
  overview: OverviewPanel,
  topics: TopicsPanel,
  pyqs: PyqsPanel,
  practice: PracticePanel,
  "mock-questions": MockQuestionsPanel,
  "weak-areas": WeakAreasPanel,
  revision: RevisionPanel,
};

export function SubjectTabs({ data, catalog }: { data: SubjectPageData; catalog: Catalog }) {
  const model = useProgressModel(catalog);
  const status = useDataStatus();
  const [tab, setTab] = useHashTab(TAB_IDS, "overview");
  const barRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback(
    (next: SubjectTab) => {
      setTab(next);
      const bar = barRef.current;
      if (bar && bar.getBoundingClientRect().top < 64) bar.scrollIntoView({ block: "start" });
      bar?.querySelector<HTMLElement>(`[role="tab"][id$="-trigger-${next}"]`)?.focus({ preventScroll: true });
    },
    [setTab],
  );

  // Keep the active tab visible in the horizontally scrolling tab bar (small screens).
  useEffect(() => {
    const list = barRef.current?.querySelector<HTMLElement>('[role="tablist"]');
    const active = list?.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
    if (!list || !active || list.scrollWidth <= list.clientWidth) return;
    list.scrollLeft = Math.max(0, active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2);
  }, [tab]);

  const common = { data, model, status };
  return (
    <GoToTab.Provider value={goTo}>
      <Tabs value={tab} onValueChange={setTab}>
        <div ref={barRef} className="scroll-mt-16">
          <TabsList label={`${data.subject.name} sections`} className="[scrollbar-width:none]">
            {SUBJECT_TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {SUBJECT_TABS.map((t) => {
          const Panel = PANELS[t.id];
          return (
            <TabsContent key={t.id} value={t.id} className="pt-5 focus-visible:outline-offset-4">
              {/* Overview cards carry their own h2s; the other panels get a section heading for their h3s. */}
              {t.id === "overview" ? null : <h2 className="sr-only">{`${data.subject.name}: ${t.label}`}</h2>}
              <Panel {...common} />
            </TabsContent>
          );
        })}
      </Tabs>
    </GoToTab.Provider>
  );
}
