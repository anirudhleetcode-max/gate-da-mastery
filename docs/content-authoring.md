# Content authoring & verification guide

This guide is the contract for every content item on the platform, whether a person or an automated pipeline writes it. The priority order is **accuracy → content quality → exam relevance → usability**.

The Zod schemas in `src/lib/content/schema.ts` define every file's shape, and `src/lib/content/validate.ts` adds the semantic checks. Validate any file you touch:

```bash
npx tsx scripts/content/validate-file.ts <file.json> [more files]
```

## 1. Non-negotiable integrity rules

1. **Never fabricate official information.** This covers GATE questions, question numbers, dates, slots, answer keys, marks, syllabus topics, statistics and patterns.
2. **Every question carries its `origin`:** `OFFICIAL_PYQ`, `ORIGINAL_PRACTICE` or `MOCK_TEST`. Never write an original question so that it could pass for an official one: no "GATE 2025 Q.12" phrasing and no official-looking headers.
3. **Official PYQ answers must equal the official key.** `answer` is derived from `officialKeyRaw` exactly. If your independent solution disagrees with the key, do **not** change the answer. Set `answerVerification.agreesWithKey=false`, set `status=NEEDS_REVIEW` and explain the disagreement precisely in `answerVerification.notes`.
4. **Difficulty is always platform-estimated.** GATE publishes no difficulty labels, so every `difficultyRationale` starts with `Platform-estimated:`.
5. **When unsure, flag it; don't guess.** Use `NEEDS_REVIEW` and explain why.

## 2. Markdown & math conventions

- Rich-text fields are Markdown: GFM tables, fenced code blocks (```` ```python ````), and KaTeX math with `$…$` inline and `$$…$$` display. Put display math on its own lines.
- The files are JSON, so **escape every backslash**: write `"$\\frac{1}{2}$"`, not `"$\frac{1}{2}$"`.
- Use `\\mathbb{R}`, `\\mathbf{x}`, `\\top` (transpose), `\\le`, `\\ge`, `\\ne`, `\\cdot`, `\\times`, `\\sum`, `\\prod`, `\\binom{n}{k}` and `\\begin{bmatrix}…\\end{bmatrix}` (rows separated by `\\\\`).
- Put code in fenced blocks with a language tag. Keep the original indentation exactly, since Python semantics depend on it.
- Figures: `![Figure: short description of what it shows](/pyq/2026/fig/Q41-1.png)`. The path is relative to `public/`. Always write meaningful alt text; it is also what screen readers read.
- Prefer transcribing tables and relation instances as Markdown tables over images.

## 3. Official PYQ files (`content/pyqs/<year>/DA<year>-S<session>-Q<nn>.json`)

| Field | Rule |
| --- | --- |
| `id` | `DA2026-S8-Q41` (two-digit question number) |
| `origin` | `"OFFICIAL_PYQ"` |
| `paperId` | `DA-2026-S8` (see `content/exam/papers.json`) |
| `year`, `questionNumber` | From the official paper |
| `section` | `GA` for Q.1–Q.10, `DA` for Q.11–Q.65 |
| `subjectId` | `ga` for Q.1–Q.10; otherwise the syllabus subject |
| `topicId`, `subtopicIds` | From `content/syllabus.json`; the primary topic must contain at least one of the subtopics |
| `type`, `marks` | Exactly as in the official key |
| `officialKeyRaw` | The key cell verbatim, e.g. `"A;C"`, `"0.12 to 0.13"`, `"MTA"` |
| `answer` | Parsed from the key: MCQ `{kind:"MCQ",correct:"B"}`, MSQ `{kind:"MSQ",correct:["A","C"]}`, NAT `{kind:"NAT",min:0.12,max:0.13}`, MTA `{kind:"MTA",note:"…"}` |
| `stem`, `options` | **Verbatim transcription** (see §4) |
| `officialImages` | Public paths of the rendered crops of the official paper |
| `sourceIds` | `["gate2026-da-qp","gate2026-da-key"]` |
| `transcription` | `{status, notes}`: `VERIFIED` only after a second, independent check against the official rendering |
| `answerVerification` | See §6 |
| `solutionStatus` | `VERIFIED` only after an independent reviewer has checked every step |
| `conceptIds`, `formulaIds` | Leave `[]`; they are linked automatically by subtopic |
| `estimatedTimeSec` | Time a well-prepared student needs (platform estimate) |

## 4. Transcription fidelity

- Reproduce the wording **verbatim**, including notes such as "Note: ℝ denotes the set of real numbers" and rounding instructions ("rounded off to two decimal places").
- Convert mathematical notation to LaTeX without changing its meaning. Keep the variable names the paper uses.
- Do not silently fix errors in the official text. If the paper has a typo, keep it and mention it in `transcription.notes`.
- Figures and diagrams that cannot be expressed faithfully as a table or text must be included as images, cropped from the official paper.
- Code must match the paper's code character for character, including indentation.

## 5. Solution quality standard

A student must be able to understand the problem from the solution alone.

- `quick`: 2–4 lines giving the key idea and the result.
- `steps` (the default, "Detailed" view) follow the problem type:
  - Numerical: formula → substitution → calculation → simplification → final answer.
  - Conceptual: concept → reasoning → elimination → answer.
  - Algorithm: input → algorithm → execution trace → complexity → result.
  - ML: model/concept → mathematical intuition → calculation → interpretation → answer.
  - Typically 3–6 steps, each with a short `title` and a complete `body`. Show the intermediate numbers, not just the results.
- `finalAnswer`: the answer in the official format, e.g. `"**(B)**"`, `"**(A), (C)**"`, `"**0.125**"`.
- `teaching`: teaching mode. Explain the underlying concept from first principles, as if to a student who has forgotten the topic (roughly 150–400 words), then connect it back to this question.
- `optionAnalysis`: required for MCQ/MSQ. Cover all four options, and make each `verdict` consistent with the official key.
- `shortcut`: a concise exam-oriented shortcut where one genuinely exists. Omit the field rather than inventing one.
- `commonTrap`: the mistake students are most likely to make on this question.

## 6. Answer verification protocol

- **Official PYQs:**
  1. Solve independently **before** looking at the key (`scripts/content/show-question.ts` prints a question without its answer).
  2. For anything numerical or algorithmic, write and run a Python check, and store it in `checkCode`.
  3. Compare with the official key.
     - If they agree: `agreesWithKey=true`, `status="VERIFIED"`.
     - If they disagree: re-derive carefully. If the disagreement persists, keep the official answer, set `status="NEEDS_REVIEW"` and explain.
     - MTA questions: `agreesWithKey=true`, `status="VERIFIED"`. Notes must state that the key awarded marks to all, and must not speculate beyond what the question shows.
- **Original questions (mock/practice):**
  1. The author writes the question and a computational check.
  2. A **separate** reviewer solves it blind; the answers must agree.
  3. If the two disagree, or the question has more than one defensible answer, rewrite the question until it is unambiguous.
  - NAT ranges must be tight enough to be meaningful, wide enough to allow for stated rounding, and must state the rounding in the stem.

## 7. Difficulty rubric (platform-estimated)

| Level | Criteria |
| --- | --- |
| `EASY` | One concept; direct recall or a single-step computation; ≤ 1.5 min for a prepared student. |
| `MODERATE` | One concept with 2–3 steps, or two directly linked concepts; routine computation; 1.5–3 min. |
| `HARD` | Several concepts or a non-routine insight; careful case analysis or lengthy computation; a likely trap; 3–5 min. |
| `VERY_HARD` | Multi-concept synthesis that needs a non-obvious insight **and** error-prone computation; > 5 min for most students. |

An MSQ whose four statements each need independent, non-trivial checking moves up one level. Write the rationale in one sentence that names the criteria it meets.

## 8. Original questions (`content/mocks/questions/mock-NN.json`, `content/practice/<topicId>.json`)

These use the same shape as PYQs minus the official fields, plus `origin`, `sourceType: "PLATFORM_CREATED"`, `concept` (one line naming the concept tested), `testId` and `questionNumber` for mocks, and `answerVerification`.

IDs: `M07-Q12` (mock 7, question 12) and `P-<topicId>-NN` (practice).

Every original question must be:

- mathematically correct,
- unambiguous, with exactly one defensible answer (set),
- in GATE style,
- pitched at the target difficulty,
- accompanied by a verified solution.

Never copy or lightly paraphrase an official PYQ. Originals must be new problems.
