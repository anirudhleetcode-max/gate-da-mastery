/**
 * Text-only query highlighting: splits a string into plain and matched
 * segments so the caller can wrap matches in <mark> as React text nodes.
 * No HTML is ever produced from the (user-typed) query.
 */

export interface Segment {
  text: string;
  match: boolean;
}

/** Search terms from a query: whitespace-separated, punctuation-trimmed, ≥ 2 characters, longest first. */
export function queryTerms(query: string): string[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter((t) => t.length >= 2);
  // "Q14" should also highlight the "Q.14" spelling used in question titles (and vice versa).
  for (const t of [...terms]) {
    const m = t.match(/^q\.?(\d{1,2})$/);
    if (m) terms.push(`q.${m[1]}`, `q${m[1]}`);
  }
  return [...new Set(terms)].sort((a, b) => b.length - a.length).slice(0, 12);
}

/** Case-insensitive match ranges of any term in text, merged and sorted. */
export function matchRanges(text: string, terms: string[]): [number, number][] {
  if (!text || !terms.length) return [];
  const lower = text.toLowerCase();
  const ranges: [number, number][] = [];
  for (const t of terms) {
    let from = 0;
    for (;;) {
      const i = lower.indexOf(t, from);
      if (i < 0) break;
      ranges.push([i, i + t.length]);
      from = i + t.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}

export function highlightSegments(text: string, terms: string[]): Segment[] {
  const ranges = matchRanges(text, terms);
  if (!ranges.length) return text ? [{ text, match: false }] : [];
  const out: Segment[] = [];
  let pos = 0;
  for (const [a, b] of ranges) {
    if (a > pos) out.push({ text: text.slice(pos, a), match: false });
    out.push({ text: text.slice(a, b), match: true });
    pos = b;
  }
  if (pos < text.length) out.push({ text: text.slice(pos), match: false });
  return out;
}

/**
 * A short excerpt of `text` around the first match (or its beginning), cut
 * at word boundaries, with ellipses where it was trimmed.
 */
export function excerpt(text: string, terms: string[], max = 180): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const first = matchRanges(clean, terms)[0]?.[0] ?? 0;
  let start = Math.max(0, first - Math.floor(max / 3));
  if (start > 0) {
    const sp = clean.indexOf(" ", start);
    start = sp >= 0 && sp < first ? sp + 1 : start;
  }
  let end = Math.min(clean.length, start + max);
  if (end < clean.length) {
    const sp = clean.lastIndexOf(" ", end);
    if (sp > start + max / 2) end = sp;
  }
  return `${start > 0 ? "…" : ""}${clean.slice(start, end)}${end < clean.length ? "…" : ""}`;
}
