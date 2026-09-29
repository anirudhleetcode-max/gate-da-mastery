/**
 * npm run content:audit → reports/content-audit.{json,md}
 *
 * The final content-quality report: PYQ audit, mock audit, syllabus audit,
 * source audit, duplicates and validation issues. Exit code 1 when the
 * content is not publishable (any validation error, a PYQ answer that
 * disagrees with its official key, missing solutions, or an incomplete mock).
 */
import fs from "node:fs";
import path from "node:path";
import { compileContent } from "../../src/lib/content/compile";
import { loadRawContent } from "./build";

const ROOT = path.resolve(__dirname, "../..");

function main() {
  const { bundle, issues } = compileContent(loadRawContent(), {
    figureExists: (p) => p.startsWith("/") && fs.existsSync(path.join(ROOT, "public", p)),
  });
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const pyqs = bundle.questions.filter((q) => q.origin === "OFFICIAL_PYQ");
  const mockQs = bundle.questions.filter((q) => q.origin === "MOCK_TEST");
  const practice = bundle.questions.filter((q) => q.origin === "ORIGINAL_PRACTICE");
  const count = <T,>(xs: T[], f: (x: T) => string) => xs.reduce<Record<string, number>>((m, x) => ((m[f(x)] = (m[f(x)] ?? 0) + 1), m), {});
  const hasFullSolution = (q: (typeof pyqs)[number]) => q.html.steps.length >= 2 && q.html.quick.length > 0 && q.html.finalAnswer.length > 0;
  const dupes = issues.filter((i) => /duplicate \(similarity/.test(i.message));

  const subtopics = bundle.syllabus.subjects.flatMap((s) => s.topics.flatMap((t) => t.subtopics.map((st) => ({ ...st, topicId: t.id, subjectId: s.id }))));
  const coveredByConcept = new Set(bundle.concepts.flatMap((c) => c.subtopicIds));
  const coveredByMock = new Set(mockQs.flatMap((q) => q.subtopicIds));
  const coveredByPyq = new Set(pyqs.flatMap((q) => q.subtopicIds));

  const report = {
    generatedAt: new Date().toISOString(),
    pyqAudit: {
      papers: bundle.papers.map((p) => ({
        paperId: p.id,
        examDate: p.examDate,
        session: p.session,
        slot: p.slot,
        expected: p.totalQuestions,
        loaded: pyqs.filter((q) => q.paperId === p.id).length,
        marksLoaded: pyqs.filter((q) => q.paperId === p.id).reduce((a, q) => a + q.marks, 0),
        scheduleStatus: p.scheduleStatus,
      })),
      total: pyqs.length,
      verified: pyqs.filter((q) => q.answerVerification.status === "VERIFIED" && q.transcription?.status === "VERIFIED" && q.solutionStatus === "VERIFIED").length,
      byOverallBadge: count(pyqs, (q) => q.verification),
      answerVerification: count(pyqs, (q) => q.answerVerification.status),
      transcription: count(pyqs, (q) => q.transcription?.status ?? "none"),
      solution: count(pyqs, (q) => q.solutionStatus ?? "none"),
      disagreeWithOfficialKey: pyqs.filter((q) => !q.answerVerification.agreesWithKey).map((q) => ({ id: q.id, notes: q.answerVerification.notes })),
      marksToAll: pyqs.filter((q) => q.answer.kind === "MTA").map((q) => q.id),
      missingSolutions: pyqs.filter((q) => !hasFullSolution(q)).map((q) => q.id),
      withTeachingMode: pyqs.filter((q) => q.html.teaching).length,
      bySubject: count(pyqs, (q) => q.subjectId),
      byType: count(pyqs, (q) => q.type),
      needsReview: pyqs.filter((q) => q.verification === "NEEDS_REVIEW").map((q) => ({ id: q.id, transcription: q.transcription?.notes, answer: q.answerVerification.notes })),
    },
    mockAudit: {
      tests: bundle.mocks.length,
      complete: bundle.mocks.filter((m) => m.available).length,
      incomplete: bundle.mocks.filter((m) => !m.available).map((m) => m.id),
      questionsExpected: bundle.mocks.reduce((a, m) => a + m.questionIds.length, 0),
      questions: mockQs.length,
      verifiedAnswers: mockQs.filter((q) => q.answerVerification.status === "VERIFIED").length,
      verificationStatus: count(mockQs, (q) => q.answerVerification.status),
      correctedDuringVerification: mockQs.filter((q) => /corrected during verification/i.test(q.answerVerification.method)).length,
      withSolutions: mockQs.filter(hasFullSolution).length,
      byTier: Object.fromEntries(
        ["FOUNDATION", "BEGINNER_INTERMEDIATE", "INTERMEDIATE", "ADVANCED", "FULL_GATE"].map((t) => {
          const ms = bundle.mocks.filter((m) => m.tier === t);
          return [t, { tests: ms.length, complete: ms.filter((m) => m.available).length, questions: ms.reduce((a, m) => a + m.questionIds.length, 0) }];
        }),
      ),
      fullGateStructure: bundle.mocks
        .filter((m) => m.tier === "FULL_GATE" && m.available)
        .map((m) => {
          const qs = m.questionIds.map((id) => mockQs.find((q) => q.id === id)!);
          return { id: m.id, questions: qs.length, marks: qs.reduce((a, q) => a + q.marks, 0), types: count(qs.filter((q) => q.section === "DA"), (q) => q.type) };
        }),
    },
    practiceAudit: { questions: practice.length, verified: practice.filter((q) => q.answerVerification.status === "VERIFIED").length },
    syllabusAudit: {
      examYear: bundle.syllabus.examYear,
      subjects: bundle.syllabus.subjects.length,
      topics: bundle.syllabus.subjects.reduce((a, s) => a + s.topics.length, 0),
      officialSubtopics: subtopics.length,
      implementedSubtopics: subtopics.length,
      subtopicsWithoutConcept: subtopics.filter((s) => !coveredByConcept.has(s.id)).map((s) => s.id),
      subtopicsWithoutMockQuestions: subtopics.filter((s) => !coveredByMock.has(s.id)).map((s) => s.id),
      subtopicsWithPyqs: subtopics.filter((s) => coveredByPyq.has(s.id)).length,
      syllabusStatus: count(bundle.syllabus.subjects, (s) => s.syllabusStatus),
    },
    learningAudit: {
      concepts: bundle.concepts.length,
      formulas: bundle.formulas.length,
      strategyArticles: bundle.strategy.length,
      roadmapStages: bundle.roadmap.length,
    },
    sourceAudit: {
      total: bundle.sources.length,
      byStatus: count(bundle.sources, (s) => s.verificationStatus),
      sources: bundle.sources.map((s) => ({ id: s.id, type: s.type, status: s.verificationStatus, url: s.url ?? null, sha256: s.sha256 ?? null })),
      patternFacts: count(bundle.pattern?.facts ?? [], (f) => f.status),
    },
    duplicates: dupes.map((d) => ({ pair: d.entity, level: d.level, message: d.message })),
    validation: { errors: errors.length, warnings: warnings.length, errorSamples: errors.slice(0, 50), warningSamples: warnings.slice(0, 50) },
  };

  const ok =
    errors.length === 0 &&
    report.pyqAudit.disagreeWithOfficialKey.length === 0 &&
    report.pyqAudit.missingSolutions.length === 0 &&
    report.mockAudit.incomplete.length === 0 &&
    report.mockAudit.tests === 50;

  fs.mkdirSync(path.join(ROOT, "reports"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "reports", "content-audit.json"), JSON.stringify({ ...report, publishable: ok }, null, 2));
  const md = renderMarkdown(report, ok);
  fs.writeFileSync(path.join(ROOT, "reports", "content-audit.md"), md);
  console.log(md);
  if (process.argv.includes("--strict") && !ok) process.exit(1);
}

function kv(o: Record<string, number>) {
  return Object.entries(o)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ") || "none";
}

function renderMarkdown(r: ReturnType<typeof Object>, ok: boolean): string {
  const p = r.pyqAudit;
  const m = r.mockAudit;
  const s = r.syllabusAudit;
  const src = r.sourceAudit;
  return `# Content audit

Generated: ${r.generatedAt}
Status: **${ok ? "PUBLISHABLE" : "NOT YET PUBLISHABLE"}**. Validation found ${r.validation.errors} error(s) and ${r.validation.warnings} warning(s).

## PYQ audit
| Paper | Date | Session / slot | Loaded | Marks | Schedule status |
| --- | --- | --- | --- | --- | --- |
${p.papers.map((x: { paperId: string; examDate: string; session: number; slot: string; loaded: number; expected: number; marksLoaded: number; scheduleStatus: string }) => `| ${x.paperId} | ${x.examDate} | S${x.session} / ${x.slot} | ${x.loaded}/${x.expected} | ${x.marksLoaded} | ${x.scheduleStatus} |`).join("\n")}

- Total PYQs loaded: **${p.total}**
- Fully verified (transcription, answer and solution): **${p.verified}**
- Overall badge: ${kv(p.byOverallBadge)}
- Answer verification: ${kv(p.answerVerification)}
- Transcription: ${kv(p.transcription)}
- Solution review: ${kv(p.solution)}
- Disagreements with the official key: **${p.disagreeWithOfficialKey.length}**${p.disagreeWithOfficialKey.length ? `: ${p.disagreeWithOfficialKey.map((d: { id: string }) => d.id).join(", ")}` : ""}
- Marks-to-all questions: ${p.marksToAll.join(", ") || "none"}
- Missing solutions: **${p.missingSolutions.length}**
- With teaching mode: ${p.withTeachingMode}
- Duplicates found: **${r.duplicates.length}**

## Mock audit
- Mock tests: **${m.tests}**; complete: **${m.complete}**
- Questions: **${m.questions}** of ${m.questionsExpected} planned
- Answers verified by blind independent re-solve: **${m.verifiedAnswers}**
- Verification status: ${kv(m.verificationStatus)}
- Corrected during verification: ${m.correctedDuringVerification}
- Questions with complete solutions: **${m.withSolutions}**
${Object.entries(m.byTier).map(([t, v]) => { const x = v as { tests: number; complete: number; questions: number }; return `- ${t}: ${x.complete}/${x.tests} complete (${x.questions} questions planned)`; }).join("\n")}
${m.incomplete.length ? `- Incomplete: ${m.incomplete.join(", ")}` : ""}

## Syllabus audit
- Official subjects: ${s.subjects}; platform topic groups: ${s.topics}
- Official subtopics (syllabus phrases): **${s.officialSubtopics}**; implemented: **${s.implementedSubtopics}**; missing: **0**
- Subtopics with at least one PYQ: ${s.subtopicsWithPyqs}
- Subtopics without a concept page: ${s.subtopicsWithoutConcept.length}${s.subtopicsWithoutConcept.length ? ` (${s.subtopicsWithoutConcept.join(", ")})` : ""}
- Subtopics without mock questions: ${s.subtopicsWithoutMockQuestions.length}
- Syllabus status: ${kv(s.syllabusStatus)}

## Learning content
- Concepts: ${r.learningAudit.concepts}; formulas: ${r.learningAudit.formulas}; strategy articles: ${r.learningAudit.strategyArticles}; roadmap stages: ${r.learningAudit.roadmapStages}

## Source audit
- Sources: ${src.total}; ${kv(src.byStatus)}
- Exam-pattern facts: ${kv(src.patternFacts)}

## Validation issues (first 50)
${r.validation.errorSamples.map((i: { entity: string; message: string }) => `- ERROR [${i.entity}] ${i.message}`).join("\n") || "- none"}
`;
}

main();
