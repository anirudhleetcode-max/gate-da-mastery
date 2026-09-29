// @vitest-environment jsdom
/**
 * Roadmap progress against a real (fake-indexeddb) Dexie database: marking a
 * stage complete records the date, moves the current stage on, and undoing it
 * moves it back.
 */
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { UserDataProvider } from "@/lib/userdata/hooks";
import { getDb, localDay } from "@/lib/userdata/db";
import { formatDate } from "@/lib/utils";
import { RoadmapView } from "./RoadmapView";
import type { RoadmapStageView } from "./types";

const stages: RoadmapStageView[] = [
  { id: "map", order: 1, title: "Map the syllabus", goal: "Know every topic.", activities: ["Read the syllabus"], exitCriteria: ["You can list every topic"], links: [{ label: "Syllabus", href: "/syllabus" }] },
  { id: "found", order: 2, title: "Foundations", goal: "Solve standard questions.", activities: ["Concept notes"], exitCriteria: ["70% on PYQs"], links: [] },
  { id: "mocks", order: 3, title: "Full mocks", goal: "Sit timed mocks.", activities: ["One mock a week"], exitCriteria: ["Three mocks reviewed"], links: [{ label: "Official site", href: "https://example.org" }] },
];

const progressText = () => screen.getByRole("heading", { name: "Your progress" }).parentElement!.textContent ?? "";

afterEach(async () => {
  cleanup();
  await getDb().roadmap.clear();
});

describe("RoadmapView", () => {
  it("marks stages complete with the date and tracks the current stage", async () => {
    render(createElement(UserDataProvider, null, createElement(RoadmapView, { stages })));
    await waitFor(() => expect(progressText()).toMatch(/0\s*of\s*3\s*stages complete/));
    expect(progressText()).toMatch(/Current stage:\s*1\. Map the syllabus/);
    expect(screen.getByRole("progressbar", { name: "Roadmap stages complete" }).getAttribute("aria-valuenow")).toBe("0");

    fireEvent.click(screen.getByRole("button", { name: /Mark complete: stage 1, Map the syllabus/ }));
    await waitFor(() => expect(progressText()).toMatch(/1\s*of\s*3\s*stages complete/));
    expect(progressText()).toMatch(/Current stage:\s*2\. Foundations/);
    const today = formatDate(localDay(new Date()));
    const stage1 = screen.getByRole("article", { name: "Map the syllabus" });
    expect(within(stage1).getByText(new RegExp(`Completed · ${today}`))).toBeTruthy();
    expect(within(screen.getByRole("article", { name: "Foundations" })).getByText("Current stage")).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/Stage 1, Map the syllabus, marked complete/));
    const row = await getDb().roadmap.get("map");
    expect(row?.completed).toBe(true);
    expect(row?.completedAt).toBeTruthy();

    // Undo: the stage is incomplete again and becomes the current stage.
    fireEvent.click(within(stage1).getByRole("button", { name: /Mark as not complete: stage 1/ }));
    await waitFor(() => expect(progressText()).toMatch(/0\s*of\s*3\s*stages complete/));
    expect(progressText()).toMatch(/Current stage:\s*1\. Map the syllabus/);
    expect((await getDb().roadmap.get("map"))?.completed).toBe(false);
  });

  it("reports when every stage is complete", async () => {
    const db = getDb();
    await db.open();
    for (const s of stages) await db.roadmap.put({ stageId: s.id, completed: true, completedAt: new Date().toISOString() });
    render(createElement(UserDataProvider, null, createElement(RoadmapView, { stages })));
    await waitFor(() => expect(progressText()).toMatch(/3\s*of\s*3\s*stages complete/));
    expect(progressText()).toMatch(/Every stage is complete/);
    expect(screen.queryByText("Current stage")).toBeNull();
  });

  it("links external resources in a new tab and internal ones in the app", async () => {
    render(createElement(UserDataProvider, null, createElement(RoadmapView, { stages })));
    const ext = await screen.findByRole("link", { name: /Official site\s*\(opens in a new tab\)/ });
    expect(ext.getAttribute("target")).toBe("_blank");
    expect(ext.getAttribute("rel")).toContain("noopener");
    expect(screen.getByRole("link", { name: /^Syllabus/ }).getAttribute("href")).toBe("/syllabus");
  });
});
