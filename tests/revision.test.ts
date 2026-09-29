import { describe, expect, it } from "vitest";
import { daysOverdue, initialState, isDue, isFrequentlyForgotten, MAX_INTERVAL_DAYS, review } from "@/lib/revision/schedule";

const d = (s: string) => new Date(`${s}T10:00:00`);

describe("spaced revision scheduling", () => {
  it("new items are due today", () => {
    const s = initialState(d("2026-10-01"));
    expect(s.nextReview).toBe("2026-10-01");
    expect(isDue(s, d("2026-10-01"))).toBe(true);
  });
  it("Got it: 3 days, then 7, then grows by ease", () => {
    let s = review(initialState(d("2026-10-01")), "got_it", d("2026-10-01"));
    expect(s.intervalDays).toBe(3);
    expect(s.nextReview).toBe("2026-10-04");
    s = review(s, "got_it", d("2026-10-04"));
    expect(s.intervalDays).toBe(7);
    s = review(s, "got_it", d("2026-10-11"));
    expect(s.intervalDays).toBeGreaterThan(7);
    expect(s.reviewCount).toBe(3);
    expect(s.confidence).toBe("got_it");
    expect(s.lastReviewed).toBeTruthy();
  });
  it("Almost: short interval and slightly lower ease", () => {
    const s = review(initialState(d("2026-10-01")), "almost", d("2026-10-01"));
    expect(s.intervalDays).toBe(2);
    expect(s.ease).toBeLessThan(2.3);
  });
  it("Forgot: tomorrow, lapse counted, ease floor respected", () => {
    let s = initialState(d("2026-10-01"));
    for (let i = 0; i < 10; i++) s = review(s, "forgot", d("2026-10-01"));
    expect(s.intervalDays).toBe(1);
    expect(s.lapses).toBe(10);
    expect(s.ease).toBeGreaterThanOrEqual(1.3);
    expect(isFrequentlyForgotten(s)).toBe(true);
  });
  it("caps intervals", () => {
    let s = initialState(d("2026-01-01"));
    let day = d("2026-01-01");
    for (let i = 0; i < 12; i++) {
      s = review(s, "got_it", day);
      day = new Date(`${s.nextReview}T10:00:00`);
    }
    expect(s.intervalDays).toBeLessThanOrEqual(MAX_INTERVAL_DAYS);
  });
  it("computes overdue days", () => {
    expect(daysOverdue({ nextReview: "2026-10-01" }, d("2026-10-04"))).toBe(3);
    expect(daysOverdue({ nextReview: "2026-10-05" }, d("2026-10-04"))).toBe(0);
  });
});
