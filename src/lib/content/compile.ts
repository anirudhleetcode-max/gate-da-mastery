/**
 * Compile raw content into the bundle served by the app.
 * Pure: takes parsed JSON, returns { bundle, issues }. File IO lives in
 * scripts/content/build.ts so this can be unit-tested with fixtures.
 */
import { z } from "zod";
import {
  Concept,
  ExamPaper,
  ExamPattern,
  Formula,
  MockTest,
  OriginalQuestion,
  Pyq,
  RoadmapStage,
  Source,
  StrategyArticle,
  Syllabus,
  type VerificationStatus,
} from "./schema";
import { buildTaxonomyIndex, findDuplicates, fingerprint, validateQuestionSemantics, type Issue } from "./validate";
import { markdownToPlain, renderDisplayMath, renderMarkdown } from "./markdown";
import type {
  CompiledConcept,
  CompiledFormula,
  CompiledQuestion,
  CompiledStrategy,
  ContentBundle,
  QuestionHtml,
  SearchDoc,
} from "./types";
import { computeWeightage } from "@/lib/weightage/compute";

export interface RawContent {
  syllabus: unknown;
  sources: unknown;
  papers: unknown;
  pattern: unknown | null;
  pyqs: { file: string; data: unknown }[];
  mockTests: unknown;
  mockQuestionFiles: { file: string; data: unknown }[];
  practiceFiles: { file: string; data: unknown }[];
  conceptFiles: { file: string; data: unknown }[];
  formulaFiles: { file: string; data: unknown }[];
  strategy: unknown | null;
  roadmap: unknown | null;
  /** Official answer-key tables parsed from the key PDFs (content/exam/official-keys.json). */
  officialKeys?: unknown | null;
}

export interface CompileOptions {
  figureExists?: (publicPath: string) => boolean;
  builtAt?: string;
}

const STATUS_RANK: Record<VerificationStatus, number> = { NEEDS_REVIEW: 0, PARTIALLY_VERIFIED: 1, VERIFIED: 2 };
export function weakest(...s: (VerificationStatus | undefined)[]): VerificationStatus {
  const xs = s.filter(Boolean) as VerificationStatus[];
  if (!xs.length) return "NEEDS_REVIEW";
  return xs.reduce((a, b) => (STATUS_RANK[a] <= STATUS_RANK[b] ? a : b));
}

export function compileContent(raw: RawContent, opts: CompileOptions = {}): { bundle: ContentBundle; issues: Issue[] } {
  const issues: Issue[] = [];
  const err = (entity: string, message: string) => issues.push({ level: "error", entity, message });
  const warn = (entity: string, message: string) => issues.push({ level: "warning", entity, message });
  const parse = <T>(schema: z.ZodType<T>, data: unknown, entity: string): T | null => {
    const r = schema.safeParse(data);
    if (r.success) return r.data;
    for (const i of r.error.issues.slice(0, 20)) err(entity, `${i.path.join(".")}: ${i.message}`);
    return null;
  };
  const md = (text: string | undefined, entity: string, field: string): string | undefined => {
    if (text === undefined) return undefined;
    const r = renderMarkdown(text);
    for (const e of r.errors) err(entity, `${field}: ${e}`);
    return r.html;
  };

  // ------------------------------------------------------------- core data
  const syllabus = parse(Syllabus, raw.syllabus, "syllabus.json");
  if (!syllabus) throw new Error("syllabus.json is invalid – cannot compile");
  const tax = buildTaxonomyIndex(syllabus);
  const sources = parse(z.array(Source), raw.sources, "sources.json") ?? [];
  const sourceIds = new Set(sources.map((s) => s.id));
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const papers = parse(z.array(ExamPaper), raw.papers, "exam/papers.json") ?? [];
  const paperById = new Map(papers.map((p) => [p.id, p]));
  const pattern = raw.pattern ? parse(ExamPattern, raw.pattern, "exam/pattern.json") : null;
  for (const p of papers) {
    for (const sid of [p.questionPaperSourceId, p.answerKeySourceId, ...p.scheduleSourceIds]) {
      if (!sourceIds.has(sid)) err(p.id, `unknown source ${sid}`);
    }
    const d = new Date(`${p.examDate}T00:00:00Z`);
    if (Number.isNaN(d.getTime()) || d.getUTCFullYear() !== p.year) err(p.id, `exam date ${p.examDate} inconsistent with year ${p.year}`);
    if (d.getUTCMonth() > 2) warn(p.id, `exam date ${p.examDate} is outside the usual Jan–Mar GATE window`);
  }
  const keyTables = parse(
    z.array(z.object({ paperId: z.string(), sourceId: z.string(), note: z.string(), rows: z.array(z.object({ q: z.number(), session: z.number(), type: z.enum(["MCQ", "MSQ", "NAT"]), section: z.enum(["GA", "DA"]), key: z.string(), marks: z.number() })) })),
    raw.officialKeys ?? [],
    "exam/official-keys.json",
  ) ?? [];
  const officialKey = new Map<string, { session: number; type: string; section: string; key: string; marks: number }>();
  for (const t of keyTables) {
    const paper = paperById.get(t.paperId);
    if (!paper) err("official-keys", `unknown paper ${t.paperId}`);
    if (!sourceIds.has(t.sourceId)) err("official-keys", `unknown source ${t.sourceId}`);
    for (const r of t.rows) officialKey.set(`${t.paperId}#${r.q}`, r);
    if (paper && t.rows.length !== paper.totalQuestions) err(t.paperId, `official key has ${t.rows.length} rows, paper has ${paper.totalQuestions} questions`);
    if (paper && t.rows.reduce((a, r) => a + r.marks, 0) !== paper.totalMarks) err(t.paperId, "official key marks do not sum to the paper total");
    if (paper && t.rows.some((r) => r.session !== paper.session)) err(t.paperId, "official key session differs from paper session");
  }
  for (const s of syllabus.subjects) for (const sid of s.sourceIds) if (!sourceIds.has(sid)) err(`syllabus:${s.id}`, `unknown source ${sid}`);
  if (pattern) for (const f of pattern.facts) for (const sid of f.sourceIds) if (!sourceIds.has(sid)) err(`pattern:${f.id}`, `unknown source ${sid}`);

  // ------------------------------------------------------------- questions
  const questions: CompiledQuestion[] = [];
  const seenIds = new Set<string>();
  const addQ = (q: CompiledQuestion) => {
    if (seenIds.has(q.id)) err(q.id, "duplicate question id");
    seenIds.add(q.id);
    questions.push(q);
  };

  const renderQuestion = (q: z.infer<typeof Pyq> | z.infer<typeof OriginalQuestion>): QuestionHtml => ({
    stem: md(q.stem, q.id, "stem")!,
    options: q.options.map((o) => ({ label: o.label, html: md(o.text, q.id, `option ${o.label}`)! })),
    quick: md(q.solution.quick, q.id, "solution.quick")!,
    steps: q.solution.steps.map((s, i) => ({ title: s.title, html: md(s.body, q.id, `step ${i + 1}`)! })),
    finalAnswer: md(q.solution.finalAnswer, q.id, "finalAnswer")!,
    teaching: md(q.solution.teaching, q.id, "teaching"),
    optionAnalysis: q.solution.optionAnalysis?.map((o) => ({ label: o.label, verdict: o.verdict, html: md(o.explanation, q.id, `optionAnalysis ${o.label}`)! })),
    shortcut: md(q.solution.shortcut, q.id, "shortcut"),
    commonTrap: md(q.solution.commonTrap, q.id, "commonTrap"),
  });
  const preview = (stem: string) => {
    const p = markdownToPlain(stem);
    return p.length > 200 ? `${p.slice(0, 197)}…` : p;
  };

  for (const { file, data } of raw.pyqs) {
    const q = parse(Pyq, data, file);
    if (!q) continue;
    issues.push(...validateQuestionSemantics(q, tax, { figureExists: opts.figureExists }));
    const paper = paperById.get(q.paperId);
    if (!paper) {
      err(q.id, `unknown paperId ${q.paperId}`);
      continue;
    }
    if (paper.year !== q.year) err(q.id, "year differs from paper year");
    if (!q.id.includes(`-S${paper.session}-`)) err(q.id, `id session does not match paper session ${paper.session}`);
    for (const sid of q.sourceIds) if (!sourceIds.has(sid)) err(q.id, `unknown source ${sid}`);
    // Independent cross-check against the machine-parsed official key table.
    const k = officialKey.get(`${q.paperId}#${q.questionNumber}`);
    if (keyTables.length) {
      if (!k) err(q.id, "no row in the official key table");
      else {
        if (k.key.replace(/\s+/g, " ").trim() !== q.officialKeyRaw.replace(/\s+/g, " ").trim()) err(q.id, `officialKeyRaw "${q.officialKeyRaw}" differs from official key table "${k.key}"`);
        if (k.type !== q.type) err(q.id, `type ${q.type} differs from official key (${k.type})`);
        if (k.marks !== q.marks) err(q.id, `marks ${q.marks} differ from official key (${k.marks})`);
        if (k.section !== q.section) err(q.id, `section ${q.section} differs from official key (${k.section})`);
      }
    }
    const srcStatus = weakest(...q.sourceIds.map((s) => sourceById.get(s)?.verificationStatus));
    addQ({
      id: q.id,
      origin: "OFFICIAL_PYQ",
      subjectId: q.subjectId,
      topicId: q.topicId,
      subtopicIds: q.subtopicIds,
      type: q.type,
      marks: q.marks,
      difficulty: q.difficulty,
      estimatedTimeSec: q.estimatedTimeSec,
      preview: preview(q.stem),
      year: q.year,
      paperId: q.paperId,
      examDate: paper.examDate,
      session: paper.session,
      slot: paper.slot,
      questionNumber: q.questionNumber,
      section: q.section,
      verification: weakest(srcStatus, q.transcription.status, q.answerVerification.status, q.solutionStatus),
      html: renderQuestion(q),
      answer: q.answer,
      difficultyRationale: q.difficultyRationale,
      conceptIds: q.conceptIds,
      formulaIds: q.formulaIds,
      similarIds: [],
      officialKeyRaw: q.officialKeyRaw,
      officialImages: q.officialImages,
      sourceIds: q.sourceIds,
      transcription: q.transcription,
      answerVerification: q.answerVerification,
      solutionStatus: q.solutionStatus,
      fingerprint: fingerprint(q.stem),
    });
  }

  const mockTests = parse(z.array(MockTest), raw.mockTests ?? [], "mocks/tests.json") ?? [];
  const compileOriginal = (file: string, data: unknown) => {
    const arr = parse(z.array(OriginalQuestion), data, file);
    if (!arr) return;
    for (const q of arr) {
      issues.push(...validateQuestionSemantics(q, tax, { figureExists: opts.figureExists }));
      addQ({
        id: q.id,
        origin: q.origin,
        subjectId: q.subjectId,
        topicId: q.topicId,
        subtopicIds: q.subtopicIds,
        type: q.type,
        marks: q.marks,
        difficulty: q.difficulty,
        estimatedTimeSec: q.estimatedTimeSec,
        preview: preview(q.stem),
        testId: q.testId,
        questionNumber: q.questionNumber,
        section: q.section,
        verification: q.answerVerification.status,
        html: renderQuestion(q),
        answer: q.answer,
        difficultyRationale: q.difficultyRationale,
        concept: q.concept,
        conceptIds: q.conceptIds,
        formulaIds: q.formulaIds,
        similarIds: [],
        sourceIds: ["platform-original"],
        answerVerification: q.answerVerification,
        fingerprint: fingerprint(q.stem),
      });
    }
  };
  for (const f of raw.mockQuestionFiles) compileOriginal(f.file, f.data);
  for (const f of raw.practiceFiles) compileOriginal(f.file, f.data);

  const qById = new Map(questions.map((q) => [q.id, q]));
  const mocks = mockTests.map((t) => {
    const qs = t.questionIds.map((id) => qById.get(id));
    const missing = t.questionIds.filter((id, i) => !qs[i]);
    if (missing.length) err(t.id, `${missing.length} question(s) missing (e.g. ${missing.slice(0, 3).join(", ")})`);
    for (const q of qs) if (q && q.testId !== t.id) err(t.id, `question ${q.id} has testId ${q.testId}`);
    const totalMarks = qs.reduce((s, q) => s + (q?.marks ?? 0), 0);
    if (t.tier === "FULL_GATE" && !missing.length) {
      if (t.questionIds.length !== 65) err(t.id, "full GATE simulation must have 65 questions");
      if (totalMarks !== 100) err(t.id, `full GATE simulation must total 100 marks (got ${totalMarks})`);
      const ga = qs.filter((q) => q?.section === "GA");
      if (ga.length !== 10 || ga.reduce((s, q) => s + (q?.marks ?? 0), 0) !== 15) err(t.id, "GA section must be 10 questions / 15 marks");
    }
    return { ...t, totalMarks, available: missing.length === 0 };
  });
  if (mocks.length && mocks.length !== 50) warn("mocks/tests.json", `expected 50 mock tests, found ${mocks.length}`);
  const numbers = new Set(mocks.map((m) => m.number));
  if (numbers.size !== mocks.length) err("mocks/tests.json", "duplicate mock numbers");
  for (const q of questions) if (q.origin === "MOCK_TEST" && !mocks.some((m) => m.id === q.testId && m.questionIds.includes(q.id))) {
    err(q.id, `mock question not listed in ${q.testId}`);
  }

  // Duplicate detection across all questions (exact fingerprint + near-duplicate shingles)
  const dupes = findDuplicates(questions.map((q) => ({ id: q.id, text: q.html.stem.replace(/<[^>]+>/g, " ") })), 0.85);
  for (const d of dupes) {
    const a = qById.get(d.a)!;
    const b = qById.get(d.b)!;
    // Two official PYQs from different papers can legitimately be similar; everything else is an error.
    const level = a.origin === "OFFICIAL_PYQ" && b.origin === "OFFICIAL_PYQ" && a.paperId !== b.paperId ? "warning" : "error";
    issues.push({ level, entity: `${d.a}~${d.b}`, message: `${d.kind} duplicate (similarity ${d.similarity})` });
  }

  // ------------------------------------------------------------- learning content
  const concepts: CompiledConcept[] = [];
  for (const { file, data } of raw.conceptFiles) {
    const arr = parse(z.array(Concept), data, file);
    if (!arr) continue;
    for (const c of arr) {
      if (tax.topics.get(c.topicId) !== c.subjectId) err(c.id, `topic ${c.topicId} not in subject ${c.subjectId}`);
      for (const st of c.subtopicIds) if (!tax.subtopics.has(st)) err(c.id, `unknown subtopic ${st}`);
      concepts.push({
        id: c.id,
        subjectId: c.subjectId,
        topicId: c.topicId,
        subtopicIds: c.subtopicIds,
        title: c.title,
        inOfficialSyllabus: c.inOfficialSyllabus,
        html: {
          definition: md(c.definition, c.id, "definition")!,
          intuition: md(c.intuition, c.id, "intuition")!,
          math: md(c.math, c.id, "math")!,
          example: md(c.example, c.id, "example")!,
          gateRelevance: md(c.gateRelevance, c.id, "gateRelevance")!,
          commonMistakes: c.commonMistakes.map((m, i) => md(m, c.id, `commonMistakes[${i}]`)!),
        },
        plain: markdownToPlain([c.definition, c.intuition].join(" ")).slice(0, 600),
        formulaIds: c.formulaIds,
        relatedConceptIds: c.relatedConceptIds,
        pyqIds: [],
        practiceIds: [],
      });
    }
  }
  const formulas: CompiledFormula[] = [];
  for (const { file, data } of raw.formulaFiles) {
    const arr = parse(z.array(Formula), data, file);
    if (!arr) continue;
    for (const f of arr) {
      if (tax.topics.get(f.topicId) !== f.subjectId) err(f.id, `topic ${f.topicId} not in subject ${f.subjectId}`);
      const fm = renderDisplayMath(f.latex);
      for (const e of fm.errors) err(f.id, `latex: ${e}`);
      formulas.push({
        id: f.id,
        subjectId: f.subjectId,
        topicId: f.topicId,
        name: f.name,
        latex: f.latex,
        html: {
          formula: fm.html,
          meaning: md(f.meaning, f.id, "meaning")!,
          whenToUse: md(f.whenToUse, f.id, "whenToUse")!,
          commonMistake: md(f.commonMistake, f.id, "commonMistake")!,
          example: md(f.example, f.id, "example")!,
          variables: f.variables.map((v) => ({ symbol: md(v.symbol, f.id, "variable")!, meaning: v.meaning })),
        },
        plain: `${f.name} ${markdownToPlain(f.meaning)}`,
        conceptIds: f.conceptIds,
      });
    }
  }
  const dupIds = (arr: { id: string }[], label: string) => {
    const s = new Set<string>();
    for (const x of arr) {
      if (s.has(x.id)) err(x.id, `duplicate ${label} id`);
      s.add(x.id);
    }
    return s;
  };
  const conceptIds = dupIds(concepts, "concept");
  const formulaIds = dupIds(formulas, "formula");
  for (const c of concepts) {
    c.formulaIds = c.formulaIds.filter((f) => (formulaIds.has(f) ? true : (warn(c.id, `unknown formula ${f}`), false)));
    c.relatedConceptIds = c.relatedConceptIds.filter((x) => (conceptIds.has(x) ? true : (warn(c.id, `unknown related concept ${x}`), false)));
  }
  for (const f of formulas) f.conceptIds = f.conceptIds.filter((x) => (conceptIds.has(x) ? true : (warn(f.id, `unknown concept ${x}`), false)));

  const strategy: CompiledStrategy[] = [];
  if (raw.strategy) {
    const arr = parse(z.array(StrategyArticle), raw.strategy, "strategy/articles.json") ?? [];
    for (const s of arr) strategy.push({ id: s.id, section: s.section, title: s.title, summary: s.summary, html: md(s.body, s.id, "body")!, plain: markdownToPlain(s.body).slice(0, 800), order: s.order });
    dupIds(strategy, "strategy");
  }
  const roadmap = raw.roadmap ? (parse(z.array(RoadmapStage), raw.roadmap, "roadmap.json") ?? []) : [];

  // ------------------------------------------------------------- relations
  const overlap = (a: string[], b: string[]) => a.some((x) => b.includes(x));
  for (const q of questions) {
    // Concepts: subtopic overlap, else same topic.
    let cs = concepts.filter((c) => overlap(c.subtopicIds, q.subtopicIds)).map((c) => c.id);
    if (!cs.length) cs = concepts.filter((c) => c.topicId === q.topicId).map((c) => c.id);
    q.conceptIds = [...new Set([...q.conceptIds.filter((x) => conceptIds.has(x)), ...cs])].slice(0, 4);
    // Formulas: those attached to the question's concepts, else the topic's.
    let fs = formulas.filter((f) => overlap(f.conceptIds, q.conceptIds)).map((f) => f.id);
    if (!fs.length) fs = formulas.filter((f) => f.topicId === q.topicId).map((f) => f.id);
    q.formulaIds = [...new Set([...q.formulaIds.filter((x) => formulaIds.has(x)), ...fs])].slice(0, 5);
  }
  // Similar questions: same subtopic first, then same topic; prefer PYQs and practice over mock items.
  const originRank = { OFFICIAL_PYQ: 0, ORIGINAL_PRACTICE: 1, MOCK_TEST: 2 } as const;
  for (const q of questions) {
    const scored = questions
      .filter((o) => o.id !== q.id && o.topicId === q.topicId && !(o.testId && o.testId === q.testId))
      .map((o) => ({ o, s: (overlap(o.subtopicIds, q.subtopicIds) ? 0 : 10) + originRank[o.origin] }))
      .sort((a, b) => a.s - b.s || a.o.id.localeCompare(b.o.id));
    q.similarIds = scored.slice(0, 8).map((x) => x.o.id);
  }
  for (const c of concepts) {
    const rel = questions.filter((q) => q.conceptIds.includes(c.id));
    c.pyqIds = rel.filter((q) => q.origin === "OFFICIAL_PYQ").map((q) => q.id);
    c.practiceIds = rel.filter((q) => q.origin === "ORIGINAL_PRACTICE").map((q) => q.id).slice(0, 12);
  }

  // ------------------------------------------------------------- weightage
  const pyqs = questions.filter((q) => q.origin === "OFFICIAL_PYQ");
  const wq = pyqs.map((q) => ({ id: q.id, paperId: q.paperId!, year: q.year!, subjectId: q.subjectId, topicId: q.topicId, type: q.type, marks: q.marks }));
  const wp = papers.map((p) => ({ id: p.id, year: p.year, examDate: p.examDate, session: p.session }));
  const subjectIds = syllabus.subjects.map((s) => s.id);
  const weightage = {
    all: computeWeightage(wq, wp, subjectIds),
    byPaper: Object.fromEntries(papers.map((p) => [p.id, computeWeightage(wq, wp, subjectIds, { paperIds: [p.id] })])),
  };
  for (const p of papers) {
    const n = pyqs.filter((q) => q.paperId === p.id).length;
    if (n && n !== p.totalQuestions) warn(p.id, `${n}/${p.totalQuestions} questions loaded`);
    const marks = pyqs.filter((q) => q.paperId === p.id).reduce((s, q) => s + q.marks, 0);
    if (n === p.totalQuestions && marks !== p.totalMarks) err(p.id, `question marks sum to ${marks}, expected ${p.totalMarks}`);
  }

  // ------------------------------------------------------------- search documents
  const subjectName = new Map(syllabus.subjects.map((s) => [s.id, s.name]));
  const topicName = new Map(syllabus.subjects.flatMap((s) => s.topics.map((t) => [t.id, t.name] as const)));
  const searchDocs: SearchDoc[] = [];
  for (const s of syllabus.subjects) {
    searchDocs.push({ id: `subject:${s.id}`, category: "subject", title: s.name, text: `${s.description} ${s.officialText}`, href: `/subjects/${s.id}`, subjectId: s.id });
    for (const t of s.topics) {
      searchDocs.push({
        id: `topic:${t.id}`,
        category: "topic",
        title: `${t.name} (${s.shortName})`,
        text: `${t.summary} ${t.subtopics.map((x) => `${x.name} ${x.officialPhrase}`).join(" ")}`,
        href: `/subjects/${s.id}/topics/${t.id}`,
        subjectId: s.id,
      });
    }
  }
  for (const q of questions) {
    if (q.origin === "MOCK_TEST") continue; // mock questions are searchable only after the mock is taken (client-side)
    const title =
      q.origin === "OFFICIAL_PYQ"
        ? `GATE DA ${q.year} · Q.${q.questionNumber} · ${topicName.get(q.topicId) ?? q.topicId}`
        : `Practice · ${topicName.get(q.topicId) ?? q.topicId}`;
    searchDocs.push({
      id: q.id,
      category: q.origin === "OFFICIAL_PYQ" ? "pyq" : "practice",
      title,
      text: `${q.preview} ${subjectName.get(q.subjectId)} ${topicName.get(q.topicId)} ${q.year ?? ""} Q${q.questionNumber ?? ""} Q.${q.questionNumber ?? ""} ${q.type}`,
      href: `/questions/${q.id}`,
      subjectId: q.subjectId,
      year: q.year,
    });
  }
  for (const c of concepts) searchDocs.push({ id: `concept:${c.id}`, category: "concept", title: c.title, text: c.plain, href: `/concepts/${c.id}`, subjectId: c.subjectId });
  for (const f of formulas) searchDocs.push({ id: `formula:${f.id}`, category: "formula", title: f.name, text: f.plain, href: `/formulas/${f.subjectId}#${f.id}`, subjectId: f.subjectId });
  for (const s of strategy) searchDocs.push({ id: `strategy:${s.id}`, category: "strategy", title: s.title, text: `${s.summary} ${s.plain}`, href: `/strategy/${s.id}` });
  for (const m of mocks) searchDocs.push({ id: `mock:${m.id}`, category: "mock", title: m.title, text: `${m.description} ${m.tier}`, href: `/mocks/${m.id}` });

  const bundle: ContentBundle = {
    version: fingerprint(JSON.stringify(questions.map((q) => q.fingerprint + q.id))),
    builtAt: opts.builtAt ?? new Date().toISOString(),
    syllabus,
    sources,
    papers,
    pattern,
    questions,
    mocks,
    concepts,
    formulas,
    strategy: strategy.sort((a, b) => a.order - b.order),
    roadmap: roadmap.sort((a, b) => a.order - b.order),
    weightage,
    searchDocs,
    issues,
  };
  return { bundle, issues };
}
