/**
 * Small deterministic pseudo-random helpers (pure, isomorphic).
 *
 * Used where a result must be reproducible from a seed: Today's GATE DA plan
 * (seeded by the date, so it stays the same all day) and Practice Now (seeded
 * per start, so a given seed always yields the same set in tests).
 */

/** 32-bit FNV-1a hash of a string: a stable seed from any text (e.g. a date). */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32: a fast, well-distributed 32-bit PRNG. Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A PRNG seeded from text. */
export function rngFrom(seed: string | number): () => number {
  return mulberry32(typeof seed === "number" ? seed : hashString(seed));
}

/** Fisher–Yates shuffle into a new array. */
export function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Weighted sampling without replacement (Efraimidis–Spirakis): every item gets
 * the key u^(1/w) and the k largest keys win. Items with weight ≤ 0 are never
 * picked. Returns items in the order they were drawn (largest key first).
 */
export function weightedSample<T>(items: readonly T[], k: number, weight: (item: T) => number, rand: () => number): T[] {
  if (k <= 0) return [];
  const keyed: { item: T; key: number }[] = [];
  for (const item of items) {
    const w = weight(item);
    const u = rand(); // drawn for every item so the sequence does not depend on weights
    if (!(w > 0)) continue;
    keyed.push({ item, key: Math.log(Math.max(u, 1e-12)) / w });
  }
  keyed.sort((a, b) => b.key - a.key);
  return keyed.slice(0, k).map((x) => x.item);
}

/** Days since 1970-01-01 for a local "YYYY-MM-DD" day (timezone-independent). */
export function dayNumber(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86_400_000);
}
