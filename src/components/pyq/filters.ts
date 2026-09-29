/**
 * PYQ browser filtering, sorting and grouping. Pure functions shared by the
 * server page (parsing ?subject=ml&year=2026 …) and the client browser.
 */
import type { Difficulty, QuestionType, SubjectId } from "@/lib/content/schema";
import type { QuestionMeta } from "@/lib/content/types";
import { DIFFICULTY_LABEL, DIFFICULTY_ORDER } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import { slotName, type PaperInfo, type TaxonomySubject } from "./data";
import { isAttempted, type PyqState } from "./status";

// ------------------------------------------------------------------ options

export const SORTS = ["newest", "oldest", "easy", "hard", "topic"] as const;
export type SortKey = (typeof SORTS)[number];
export const SORT_LABEL: Record<SortKey, string> = {
  newest: "Newest → Oldest",
  oldest: "Oldest → Newest",
  easy: "Easy → Hard",
  hard: "Hard → Easy",
  topic: "Topic-wise",
};

export const STATUSES = ["unsolved", "attempted", "correct", "incorrect", "bookmarked"] as const;
export type StatusKey = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<StatusKey, string> = {
  unsolved: "Unsolved (not attempted)",
  attempted: "Attempted",
  correct: "Solved correctly",
  incorrect: "Answered incorrectly",
  bookmarked: "Bookmarked",
};

export const TYPES: QuestionType[] = ["MCQ", "MSQ", "NAT"];
export const MARKS = ["1", "2"] as const;
export type MarksKey = (typeof MARKS)[number];

export interface BrowseFilters {
  year: string;
  paper: string;
  subject: string;
  topic: string;
  subtopic: string;
  difficulty: Difficulty | "";
  type: QuestionType | "";
  marks: MarksKey | "";
  status: StatusKey | "";
  q: string;
  sort: SortKey;
}
export type FilterKey = Exclude<keyof BrowseFilters, "sort">;

export const DEFAULT_FILTERS: BrowseFilters = {
  year: "",
  paper: "",
  subject: "",
  topic: "",
  subtopic: "",
  difficulty: "",
  type: "",
  marks: "",
  status: "",
  q: "",
  sort: "newest",
};

/** Order in which filters appear in the URL and as chips. */
export const FILTER_KEYS: FilterKey[] = ["subject", "topic", "subtopic", "year", "paper", "difficulty", "type", "marks", "status", "q"];

// ------------------------------------------------------------------ context & normalisation

export interface FilterContext {
  years: Set<string>;
  paperYear: Map<string, string>;
  subjects: Set<string>;
  topicSubject: Map<string, string>;
  subtopicTopic: Map<string, string>;
}

export function buildFilterContext(taxonomy: TaxonomySubject[], papers: PaperInfo[]): FilterContext {
  const topicSubject = new Map<string, string>();
  const subtopicTopic = new Map<string, string>();
  for (const s of taxonomy)
    for (const t of s.topics) {
      topicSubject.set(t.id, s.id);
      for (const st of t.subtopics) if (!subtopicTopic.has(st.id)) subtopicTopic.set(st.id, t.id);
    }
  return {
    years: new Set(papers.map((p) => String(p.year))),
    paperYear: new Map(papers.map((p) => [p.id, String(p.year)])),
    subjects: new Set(taxonomy.map((s) => s.id)),
    topicSubject,
    subtopicTopic,
  };
}

/** Drop unknown values and keep subject → topic (→ subtopic) consistent (a topic implies its subject). */
export function normalizeFilters(f: BrowseFilters, ctx: FilterContext): BrowseFilters {
  const out = { ...f };
  if (out.year && !ctx.years.has(out.year)) out.year = "";
  if (out.paper) {
    const y = ctx.paperYear.get(out.paper);
    if (!y || (out.year && out.year !== y)) out.paper = "";
  }
  if (out.subject && !ctx.subjects.has(out.subject)) out.subject = "";
  if (out.subtopic) {
    // A syllabus phrase on its own matches every question tagged with it, whichever topic the
    // question is filed under (many phrases are tested inside neighbouring topics). With a topic
    // selected, the phrase must belong to that topic.
    const t = ctx.subtopicTopic.get(out.subtopic);
    if (!t || (out.topic && out.topic !== t)) out.subtopic = "";
  }
  if (out.topic) {
    const s = ctx.topicSubject.get(out.topic);
    if (!s || (out.subject && out.subject !== s)) {
      out.topic = "";
      out.subtopic = "";
    } else out.subject = s;
  }
  return out;
}

type Params = Pick<URLSearchParams, "get"> | Record<string, string | string[] | undefined>;
function param(p: Params, k: string): string {
  if (typeof p.get === "function") return (p as Pick<URLSearchParams, "get">).get(k) ?? "";
  const v = (p as Record<string, string | string[] | undefined>)[k];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

const includes = <T extends string>(list: readonly T[], v: string): v is T => (list as readonly string[]).includes(v);

export function parseFilters(p: Params, ctx: FilterContext): BrowseFilters {
  const difficulty = param(p, "difficulty").toUpperCase().replace(/-/g, "_");
  const type = param(p, "type").toUpperCase();
  const marks = param(p, "marks");
  const rawStatus = param(p, "status").toLowerCase();
  const status = rawStatus === "solved-correct" || rawStatus === "solved" ? "correct" : rawStatus === "unattempted" ? "unsolved" : rawStatus;
  const sort = param(p, "sort").toLowerCase();
  return normalizeFilters(
    {
      year: param(p, "year"),
      paper: param(p, "paper"),
      subject: param(p, "subject").toLowerCase(),
      topic: param(p, "topic"),
      subtopic: param(p, "subtopic"),
      difficulty: includes(DIFFICULTY_ORDER, difficulty) ? difficulty : "",
      type: includes(TYPES, type) ? type : "",
      marks: includes(MARKS, marks) ? marks : "",
      status: includes(STATUSES, status) ? status : "",
      q: param(p, "q").slice(0, 120),
      sort: includes(SORTS, sort) ? sort : "newest",
    },
    ctx,
  );
}

/** Stable query string ("subject=ml&year=2026"); defaults are omitted. */
export function filtersToQuery(f: BrowseFilters): string {
  const u = new URLSearchParams();
  for (const k of FILTER_KEYS) {
    const v = k === "q" ? f.q.trim() : f[k];
    if (!v) continue;
    if (k === "difficulty") u.set(k, v.toLowerCase().replace(/_/g, "-"));
    else if (k === "type") u.set(k, v.toLowerCase());
    else u.set(k, v);
  }
  if (f.sort !== "newest") u.set("sort", f.sort);
  return u.toString();
}

export function activeFilterCount(f: BrowseFilters): number {
  return FILTER_KEYS.filter((k) => (k === "q" ? f.q.trim() : f[k])).length;
}

// ------------------------------------------------------------------ search

export type SearchToken = { kind: "qnum"; n: number } | { kind: "text"; t: string };

/** "q12", "Q.12", "q 12" and "question 12" match a question number; other words match the text. */
export function parseSearch(q: string): SearchToken[] {
  const s = q.toLowerCase().replace(/\b(?:q|question|ques)\s*\.?\s*(\d{1,2})\b/g, " q#$1 ");
  return s
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}#]+|[^\p{L}\p{N}#]+$/gu, ""))
    .filter(Boolean)
    .map((w): SearchToken => {
      const m = /^q#(\d{1,2})$/.exec(w);
      return m ? { kind: "qnum", n: Number(m[1]) } : { kind: "text", t: w };
    });
}

const SYMBOL_WORDS: Record<string, string> = {
  α: "alpha", β: "beta", γ: "gamma", δ: "delta", ε: "epsilon", η: "eta", θ: "theta", λ: "lambda", μ: "mu", π: "pi",
  ρ: "rho", σ: "sigma", τ: "tau", φ: "phi", χ: "chi", ψ: "psi", ω: "omega", Δ: "delta", Σ: "sigma sum", Π: "pi product",
  Φ: "phi", Ω: "omega", ℝ: "R real", ℕ: "N natural", ℤ: "Z integer", "∞": "infinity", "√": "sqrt", "∈": "in", "∫": "integral",
};
const SYMBOL_RE = new RegExp(`[${Object.keys(SYMBOL_WORDS).join("")}]`, "gu");

/** Words for the symbols in a preview ("σ" → "sigma"), so searches typed in ASCII still match. */
export function symbolWords(text: string): string {
  const out = new Set<string>();
  for (const m of text.matchAll(SYMBOL_RE)) out.add(SYMBOL_WORDS[m[0]]);
  return [...out].join(" ");
}

export interface RowFacts {
  state: PyqState;
  bookmarked: boolean;
  /** Lower-cased text the search runs over. */
  haystack: string;
}

function statusMatches(status: StatusKey, r: RowFacts): boolean {
  switch (status) {
    case "unsolved":
      return !isAttempted(r.state);
    case "attempted":
      return isAttempted(r.state);
    case "correct":
      return r.state === "correct";
    case "incorrect":
      return r.state === "incorrect";
    case "bookmarked":
      return r.bookmarked;
  }
}

/** Every status filter a question currently satisfies (used for the status facet counts). */
export function statusKeysOf(r: RowFacts): StatusKey[] {
  return STATUSES.filter((s) => statusMatches(s, r));
}

export function rowMatches(m: QuestionMeta, f: BrowseFilters, tokens: SearchToken[], r: RowFacts, skip?: ReadonlySet<FilterKey>): boolean {
  const on = (k: FilterKey) => !skip || !skip.has(k);
  if (on("year") && f.year && String(m.year) !== f.year) return false;
  if (on("paper") && f.paper && m.paperId !== f.paper) return false;
  if (on("subject") && f.subject && m.subjectId !== f.subject) return false;
  if (on("topic") && f.topic && m.topicId !== f.topic) return false;
  if (on("subtopic") && f.subtopic && !m.subtopicIds.includes(f.subtopic)) return false;
  if (on("difficulty") && f.difficulty && m.difficulty !== f.difficulty) return false;
  if (on("type") && f.type && m.type !== f.type) return false;
  if (on("marks") && f.marks && String(m.marks) !== f.marks) return false;
  if (on("status") && f.status && !statusMatches(f.status, r)) return false;
  if (on("q") && tokens.length && !tokens.every((t) => (t.kind === "qnum" ? m.questionNumber === t.n : r.haystack.includes(t.t)))) return false;
  return true;
}

/**
 * Facet counts: for one dimension, how many questions match every OTHER
 * active filter, per value. `skip` lists the filters ignored for this facet
 * (e.g. subject ignores subject/topic/subtopic).
 */
export function facetCounts(
  rows: QuestionMeta[],
  facts: Map<string, RowFacts>,
  f: BrowseFilters,
  tokens: SearchToken[],
  skip: FilterKey[],
  valuesOf: (m: QuestionMeta, r: RowFacts) => string | string[],
): Map<string, number> {
  const out = new Map<string, number>();
  const skipSet = new Set(skip);
  for (const m of rows) {
    const r = facts.get(m.id)!;
    if (!rowMatches(m, f, tokens, r, skipSet)) continue;
    const v = valuesOf(m, r);
    for (const x of Array.isArray(v) ? v : [v]) out.set(x, (out.get(x) ?? 0) + 1);
  }
  return out;
}

// ------------------------------------------------------------------ sorting & grouping

export interface ResultGroup {
  key: string;
  title: string;
  detail: string;
  subjectId?: SubjectId;
  count: number;
  marks: number;
}

export type ResultItem = { kind: "header"; key: string; groupIndex: number } | { kind: "row"; key: string; groupIndex: number; meta: QuestionMeta };

export interface GroupLookups {
  paperById: Map<string, PaperInfo>;
  subjectOrder: Map<string, number>;
  subjectName: Map<string, string>;
  topicOrder: Map<string, number>;
  topicName: Map<string, string>;
}

export function buildGroupLookups(taxonomy: TaxonomySubject[], papers: PaperInfo[]): GroupLookups {
  const topicOrder = new Map<string, number>();
  const topicName = new Map<string, string>();
  let i = 0;
  for (const s of taxonomy)
    for (const t of s.topics) {
      topicOrder.set(t.id, i++);
      topicName.set(t.id, t.name);
    }
  return {
    paperById: new Map(papers.map((p) => [p.id, p])),
    subjectOrder: new Map(taxonomy.map((s, idx) => [s.id, idx])),
    subjectName: new Map(taxonomy.map((s) => [s.id, s.name])),
    topicOrder,
    topicName,
  };
}

const newestFirst = (a: QuestionMeta, b: QuestionMeta) =>
  (b.year ?? 0) - (a.year ?? 0) || (b.session ?? 0) - (a.session ?? 0) || (a.questionNumber ?? 0) - (b.questionNumber ?? 0);
const oldestFirst = (a: QuestionMeta, b: QuestionMeta) =>
  (a.year ?? 0) - (b.year ?? 0) || (a.session ?? 0) - (b.session ?? 0) || (a.questionNumber ?? 0) - (b.questionNumber ?? 0);

export function buildResults(rows: QuestionMeta[], sort: SortKey, look: GroupLookups): { groups: ResultGroup[]; items: ResultItem[]; orderedIds: string[] } {
  const diffIdx = (d: Difficulty) => DIFFICULTY_ORDER.indexOf(d);
  let sorted: QuestionMeta[];
  let groupKey: (m: QuestionMeta) => string;
  let describe: (m: QuestionMeta) => Omit<ResultGroup, "key" | "count" | "marks">;

  if (sort === "easy" || sort === "hard") {
    const dir = sort === "easy" ? 1 : -1;
    sorted = [...rows].sort((a, b) => dir * (diffIdx(a.difficulty) - diffIdx(b.difficulty)) || newestFirst(a, b));
    groupKey = (m) => m.difficulty;
    describe = (m) => ({ title: DIFFICULTY_LABEL[m.difficulty], detail: "Platform-estimated difficulty" });
  } else if (sort === "topic") {
    const so = (m: QuestionMeta) => look.subjectOrder.get(m.subjectId) ?? 99;
    const to = (m: QuestionMeta) => look.topicOrder.get(m.topicId) ?? 9999;
    sorted = [...rows].sort((a, b) => so(a) - so(b) || to(a) - to(b) || newestFirst(a, b));
    groupKey = (m) => m.topicId;
    describe = (m) => ({ title: look.topicName.get(m.topicId) ?? m.topicId, detail: look.subjectName.get(m.subjectId) ?? m.subjectId, subjectId: m.subjectId });
  } else {
    sorted = [...rows].sort(sort === "oldest" ? oldestFirst : newestFirst);
    groupKey = (m) => m.paperId ?? String(m.year);
    describe = (m) => {
      const p = m.paperId ? look.paperById.get(m.paperId) : undefined;
      return p
        ? { title: `GATE DA ${p.year} · Session ${p.session}`, detail: `${formatDate(p.examDate)} · ${slotName(p.slot)}, ${p.slotTime}` }
        : { title: `GATE DA ${m.year}`, detail: m.examDate ? formatDate(m.examDate) : "" };
    };
  }

  const groups: ResultGroup[] = [];
  const items: ResultItem[] = [];
  let current = "";
  for (const m of sorted) {
    const k = groupKey(m);
    if (k !== current || !groups.length) {
      current = k;
      groups.push({ key: k, count: 0, marks: 0, ...describe(m) });
      items.push({ kind: "header", key: `h:${k}`, groupIndex: groups.length - 1 });
    }
    const g = groups[groups.length - 1];
    g.count++;
    g.marks += m.marks;
    items.push({ kind: "row", key: m.id, groupIndex: groups.length - 1, meta: m });
  }
  return { groups, items, orderedIds: sorted.map((m) => m.id) };
}
