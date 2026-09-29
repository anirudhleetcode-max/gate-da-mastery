"use client";
import { useCallback, useEffect, useRef } from "react";
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

const TAB_IDS = SUBJECT_TABS.map((t) => t.id);

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
        <TabsContent value="overview" className="pt-5 focus-visible:outline-offset-4">
          <OverviewPanel {...common} />
        </TabsContent>
        <TabsContent value="topics" className="pt-5 focus-visible:outline-offset-4">
          <TopicsPanel {...common} />
        </TabsContent>
        <TabsContent value="pyqs" className="pt-5 focus-visible:outline-offset-4">
          <PyqsPanel {...common} />
        </TabsContent>
        <TabsContent value="practice" className="pt-5 focus-visible:outline-offset-4">
          <PracticePanel {...common} />
        </TabsContent>
        <TabsContent value="mock-questions" className="pt-5 focus-visible:outline-offset-4">
          <MockQuestionsPanel {...common} />
        </TabsContent>
        <TabsContent value="weak-areas" className="pt-5 focus-visible:outline-offset-4">
          <WeakAreasPanel {...common} />
        </TabsContent>
        <TabsContent value="revision" className="pt-5 focus-visible:outline-offset-4">
          <RevisionPanel {...common} />
        </TabsContent>
      </Tabs>
    </GoToTab.Provider>
  );
}
