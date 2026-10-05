"use client";
import { useEffect, useState } from "react";

export interface JumpTopic {
  /** Element id of the topic section (e.g. "topic-la-eigen"). */
  id: string;
  title: string;
  count: number;
}

/** Sections whose top has scrolled above this line (px from the viewport top) count as "being read". */
const READ_LINE = 140;

/**
 * Small screens: a bar that sticks under the app header with a topic picker,
 * so any topic of a long formula book is one tap away and the bar shows which
 * topic is on screen. (Large screens use the sticky side list instead.)
 * Choosing a topic scrolls to it; focus stays on the picker.
 */
export function TopicJumpBar({ topics, label = "Topic" }: { topics: JumpTopic[]; label?: string }) {
  const [current, setCurrent] = useState(topics[0]?.id ?? "");

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let at = topics[0]?.id ?? "";
      for (const t of topics) {
        const el = document.getElementById(t.id);
        if (el && el.getBoundingClientRect().top <= READ_LINE) at = t.id;
      }
      setCurrent(at);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [topics]);

  function jump(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    setCurrent(id);
    el.scrollIntoView({ block: "start" });
    // Keep Next.js's history state; only the hash changes, so the topic can be shared and Back returns here.
    window.history.replaceState(window.history.state, "", `#${id}`);
  }

  if (topics.length < 2) return null;
  return (
    <div className="no-print sticky top-14 z-10 -mx-4 mb-4 border-b border-border bg-bg/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:hidden">
      <label htmlFor="topic-jump" className="flex min-w-0 items-center gap-2 text-xs font-medium text-fg-3">
        <span className="shrink-0">{label}</span>
        <select
          id="topic-jump"
          value={current}
          onChange={(e) => jump(e.target.value)}
          className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-surface px-2.5 text-sm font-normal text-fg"
        >
          {topics.map((t, i) => (
            <option key={t.id} value={t.id}>
              {i + 1}. {t.title} ({t.count})
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
