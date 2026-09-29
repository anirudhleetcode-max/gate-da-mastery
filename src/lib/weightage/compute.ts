/**
 * Historical subject/topic weightage computed ONLY from classified official
 * PYQs. Nothing here is a prediction: outputs are labelled "historical
 * estimate", carry the number of papers they are based on, and never mix
 * different exam papers into an anonymous pool (every figure is per paper).
 */

export interface WeightageQuestion {
  id: string;
  paperId: string;
  year: number;
  subjectId: string;
  topicId: string;
  type: "MCQ" | "MSQ" | "NAT";
  marks: number;
}

export interface WeightagePaper {
  id: string;
  year: number;
  examDate: string;
  session: number;
}

export interface SubjectPaperStat {
  paperId: string;
  year: number;
  questions: number;
  marks: number;
  byType: Record<"MCQ" | "MSQ" | "NAT", number>;
}

export type Variation = "Low" | "Medium" | "High" | "Insufficient data";

export interface SubjectWeightage {
  subjectId: string;
  perPaper: SubjectPaperStat[];
  papersAppeared: number;
  totalPapers: number;
  marksMin: number;
  marksMax: number;
  marksMean: number;
  questionsMin: number;
  questionsMax: number;
  questionsMean: number;
  /** Coefficient of variation of marks across papers (population SD / mean). */
  marksCv: number | null;
  variation: Variation;
  /** Share of all subject marks across the selected papers (0–1). */
  shareOfMarks: number;
}

export interface TopicFrequency {
  topicId: string;
  subjectId: string;
  questions: number;
  marks: number;
  papersAppeared: number;
}

export interface WeightageResult {
  papers: WeightagePaper[];
  subjects: SubjectWeightage[];
  topics: TopicFrequency[];
  totalMarks: number;
  confidenceNote: string;
}

export function variationLabel(cv: number | null, papers: number): Variation {
  if (cv === null || papers < 2) return "Insufficient data";
  if (cv < 0.2) return "Low";
  if (cv < 0.4) return "Medium";
  return "High";
}

export function computeWeightage(
  questions: WeightageQuestion[],
  papers: WeightagePaper[],
  subjectIds: string[],
  opts: { paperIds?: string[] } = {},
): WeightageResult {
  const selected = papers
    .filter((p) => !opts.paperIds || opts.paperIds.includes(p.id))
    .sort((a, b) => a.year - b.year || a.session - b.session);
  const selectedIds = new Set(selected.map((p) => p.id));
  const qs = questions.filter((q) => selectedIds.has(q.paperId));
  const totalMarks = qs.reduce((s, q) => s + q.marks, 0);

  const subjects: SubjectWeightage[] = subjectIds.map((sid) => {
    const perPaper: SubjectPaperStat[] = selected.map((p) => {
      const inPaper = qs.filter((q) => q.paperId === p.id && q.subjectId === sid);
      const byType = { MCQ: 0, MSQ: 0, NAT: 0 } as Record<"MCQ" | "MSQ" | "NAT", number>;
      for (const q of inPaper) byType[q.type]++;
      return {
        paperId: p.id,
        year: p.year,
        questions: inPaper.length,
        marks: inPaper.reduce((s, q) => s + q.marks, 0),
        byType,
      };
    });
    const marks = perPaper.map((x) => x.marks);
    const counts = perPaper.map((x) => x.questions);
    const n = perPaper.length;
    const mean = n ? marks.reduce((a, b) => a + b, 0) / n : 0;
    const sd = n ? Math.sqrt(marks.reduce((s, m) => s + (m - mean) ** 2, 0) / n) : 0;
    const cv = n >= 2 && mean > 0 ? sd / mean : null;
    const subjMarks = marks.reduce((a, b) => a + b, 0);
    return {
      subjectId: sid,
      perPaper,
      papersAppeared: perPaper.filter((x) => x.questions > 0).length,
      totalPapers: n,
      marksMin: n ? Math.min(...marks) : 0,
      marksMax: n ? Math.max(...marks) : 0,
      marksMean: round(mean, 2),
      questionsMin: n ? Math.min(...counts) : 0,
      questionsMax: n ? Math.max(...counts) : 0,
      questionsMean: round(n ? counts.reduce((a, b) => a + b, 0) / n : 0, 2),
      marksCv: cv === null ? null : round(cv, 3),
      variation: variationLabel(cv, n),
      shareOfMarks: totalMarks ? round(subjMarks / totalMarks, 4) : 0,
    };
  });

  const topicMap = new Map<string, TopicFrequency & { papers: Set<string> }>();
  for (const q of qs) {
    const t = topicMap.get(q.topicId) ?? {
      topicId: q.topicId,
      subjectId: q.subjectId,
      questions: 0,
      marks: 0,
      papersAppeared: 0,
      papers: new Set<string>(),
    };
    t.questions++;
    t.marks += q.marks;
    t.papers.add(q.paperId);
    topicMap.set(q.topicId, t);
  }
  const topics = [...topicMap.values()]
    .map(({ papers: ps, ...rest }) => ({ ...rest, papersAppeared: ps.size }))
    .sort((a, b) => b.marks - a.marks || b.questions - a.questions || a.topicId.localeCompare(b.topicId));

  return {
    papers: selected,
    subjects,
    topics,
    totalMarks,
    confidenceNote: confidenceNote(selected.length),
  };
}

export function confidenceNote(n: number): string {
  if (n === 0) return "No verified papers selected. No weightage can be computed.";
  if (n === 1)
    return "This is based on a single paper. It shows what that paper contained, not a trend. Treat it as one observation.";
  if (n < 5)
    return `This is based on ${n} papers. With so few observations, the ranges are indicative only; a subject's share can shift noticeably from one year to the next.`;
  return `This is based on ${n} papers. The ranges are historical observations, not guarantees.`;
}

function round(x: number, d: number): number {
  const f = 10 ** d;
  return Math.round(x * f) / f;
}
