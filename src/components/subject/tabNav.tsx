"use client";
import { createContext, useContext, type ReactNode } from "react";

export const SUBJECT_TABS = [
  { id: "overview", label: "Overview" },
  { id: "topics", label: "Topics" },
  { id: "pyqs", label: "PYQs" },
  { id: "practice", label: "Practice" },
  { id: "mock-questions", label: "Mock questions" },
  { id: "weak-areas", label: "Weak areas" },
  { id: "revision", label: "Revision" },
] as const;
export type SubjectTab = (typeof SUBJECT_TABS)[number]["id"];

export const GoToTab = createContext<(tab: SubjectTab) => void>(() => {});

/** In-page link that switches the subject tab (and brings the tab bar into view). */
export function TabLink({ tab, children, className }: { tab: SubjectTab; children: ReactNode; className?: string }) {
  const go = useContext(GoToTab);
  return (
    <a
      href={`#${tab}`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        go(tab);
      }}
      className={className ?? "font-medium text-accent-text hover:underline"}
    >
      {children}
    </a>
  );
}
