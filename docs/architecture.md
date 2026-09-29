# Architecture

GATE DA Mastery is a **Next.js 16 (App Router) + React 19 + TypeScript** application with Tailwind CSS 4.

It has two data layers:

1. **Content**: official PYQs, original mock and practice questions, concepts, formulas, strategy and syllabus. Content is authored as JSON in `content/` and validated with Zod (`src/lib/content/schema.ts` plus `validate.ts`). It is compiled by `npm run content:build` into `generated/content.json`, and the server loads it once into an in-memory, indexed repository (`src/lib/server/repo.ts`). Markdown is pre-rendered to HTML at build time. Math is stored as compact placeholders and rendered with KaTeX by `hydrateMath()`: on the server for SSR pages, and in the browser for content fetched from the API.
2. **User data**: attempts, mock attempts, bookmarks, revision queue, error log, roadmap and settings. It is **local-first** in IndexedDB via Dexie (`src/lib/userdata/db.ts`). Every mutation goes through `src/lib/userdata/ops.ts`, and every read through the live hooks in `src/lib/userdata/hooks.tsx`. Nothing is seeded, ever. An optional demo mode uses a separate database, and a persistent **DEMO DATA** banner shows while it is active.

There is no authentication and no server-side user database, because no credentials or hosted database were available. Backup and restore is a JSON export/import on the Settings page. A sync adapter can be added behind `ops.ts` later.

## Directory layout

```
content/                  source-of-truth content (JSON, reviewed via git)
  syllabus.json           official syllabus → platform topic groups → official-phrase subtopics
  sources.json            source registry (URLs, SHA-256, verification status + notes)
  exam/papers.json        each official DA paper: date, session, slot, institute, schedule status
  exam/pattern.json       verified exam-pattern facts + marking scheme
  pyqs/<year>/DA<year>-S<session>-Q<nn>.json   one file per official question
  mocks/tests.json        50 mock-test definitions
  mocks/questions/mock-NN.cK.json              mock questions (chunked files)
  practice/<topicId>.json original practice questions
  concepts/<subject>.json concept library
  formulas/<subject>.json formula book
  strategy/articles.json  exam-strategy articles
  roadmap.json            10-stage study roadmap
generated/content.json    compiled bundle (git-ignored)
scripts/content/          build.ts (compile), validate-file.ts, show-question.ts, audit.ts
scripts/sources/verify.ts re-hash official files from the official hosts
src/app/(app)/…           pages with the app shell (sidebar / mobile tabs)
src/app/(exam)/…          full-screen exam mode (no navigation chrome)
src/app/api/…             JSON routes (questions, batch, mock paper/key, search)
src/lib/content/          schema, validation, markdown, math, compile, bundle types
src/lib/server/           repo.ts (server-only content access), payload.ts
src/lib/scoring/          GATE scoring (MCQ −1/3 & −2/3, MSQ exact, NAT range, MTA)
src/lib/revision/         spaced-revision scheduler
src/lib/analytics/        accuracy, mastery, weak topics, streaks, the shared progress model
src/lib/weightage/        historical weightage computation
src/lib/userdata/         Dexie DB, operations, React hooks
src/components/ui/        design-system primitives
src/components/layout/    app shell, navigation, search box, theme toggle, demo banner
src/components/question/  QuestionView (full question experience), QuestionSession, badges
src/components/charts/    SVG chart kit (BarList, GroupedColumns, LineChart, ChartFrame)
```

## Server vs client

- **Pages are server components** by default. They read content through `@/lib/server/repo` (import only in server code, since it is `server-only`) and pass small, serialisable props to client components.
- **Anything that reads user data is a client component** (`"use client"`) using the hooks in `@/lib/userdata/hooks`. Server props must never include user data.
- Do not ship the whole question bank to the browser:
  - List views receive `QuestionMeta[]` (metadata and a 200-character preview).
  - Full questions come from `buildPayload()` on the server, or from `/api/questions/[id]` and `/api/questions/batch?ids=…` on the client.
- Exam mode gets the paper **without answers** from `/api/mocks/[id]/paper`, and fetches `/api/mocks/[id]/key` only after submission.
- Render trusted build-time HTML with `<RichHtml html=…/>` in client components and `<ServerRichHtml html=…/>` in server components. Never render user-typed strings as HTML.

## Key modules (use them; do not re-implement)

| Need | Use |
| --- | --- |
| Content lookups | `getSubjects, getSubject, getTopic, getPyqs, getPyqMetas, getQuestion, getMock, getMockQuestions, getMocks, getConcepts, getConcept, getFormulas, getStrategy, getRoadmap, getWeightage, getPapers, getSources, getPattern, getCatalog, topicStats, searchContent, toMeta` in `@/lib/server/repo`. Question getters apply the **availability gate** (`@/lib/content/availability`): questions of a mock that is not fully verified, and unverified practice questions, are invisible. Only admin tooling may use `getQuestionUnchecked`. |
| Full question for the client | `buildPayload(q)` in `@/lib/server/payload` → `QuestionPayload` |
| Interactive question | `<QuestionView q={payload} context=…/>`: attempt → submit → solution (quick/detailed/teaching) → concept → formulas → similar → revision / error log |
| Sequence of questions | `<QuestionSession ids=[…] context=… timeLimitSec?/>` |
| Scoring | `scoreQuestion, scoreTest, groupScores, formatAnswer, formatResponse, mcqPenalty` in `@/lib/scoring/score` |
| User data | hooks: `useAttempts, useQuestionStatuses, useBookmarks, useBookmarkKeys, useRevisionItems, useErrorLogs, useMockAttempts, useRoadmap, useSetting, useViews, useDbQuery, useUserData`; ops: `recordAttemptWithFollowUps, toggleBookmark, addToRevision, gradeRevision, dueRevision, addErrorLog, updateErrorLog, setRoadmapStage, exportAll, importAll, clearAll` |
| Progress numbers | `useProgressModel(catalog)` in `@/lib/analytics/useProgress` (overall, subjects, topics, mastery, weak topics, streak). Get `catalog` from `getCatalog()` on the server. |
| Stats helpers | `accuracyStat, weakTopics, topicMastery, studyStreak, accuracyTrend, wilsonLower` in `@/lib/analytics/stats`; explain them with `WEAK_TOPIC_DEFAULTS` and `MASTERY_EXPLANATION` (never copy the numbers by hand) |
| Revision scheduling | `review, isDue, isFrequentlyForgotten, initialState` in `@/lib/revision/schedule` |
| Labels & colours | `@/lib/labels` (`SUBJECT_SHORT`, `SUBJECT_ABBR`, `SUBJECT_COLOR`, `ORIGIN_LABEL`, `DIFFICULTY_LABEL`, `TIER_LABEL`, `VERIFICATION_LABEL`, …) |
| Formatting | `cn, pct, formatMarks, formatDuration, formatClock, formatDate, plural` in `@/lib/utils` |
| Web-storage values | `useStorageValue(key, "local" / "session")` in `@/lib/useStorage` (never set state from an effect just to read storage) |

UI primitives live in `src/components/ui`: `Button`, `ButtonLink`, `Card`, `CardHeader`, `CardBody`, `Badge`, `ProgressBar`, `Stat`, `EmptyState`, `PageHeader` (with breadcrumbs), `Segmented`, `Select`, `Tabs`, `Dialog`, `Callout`, `RichHtml` and `ServerRichHtml`. The question badges are `OriginBadge`, `VerificationBadge`, `DifficultyBadge` and `TypeBadge`. Charts are `ChartFrame` (title, legend, **table view**), `BarList`, `GroupedColumns`, `LineChart` and `DataTable`.

## Design rules

- **Tokens only.** Colour comes from CSS variables (`bg-surface`, `text-fg-2`, `border-border`, `bg-accent-soft`, `text-success`, …); dark mode is automatic. Subject colours come from `SUBJECT_COLOR`, in a fixed order. Text never takes a series colour.
- **Professional and calm.** No gradients, no decorative animation, no stock illustrations. Use clear hierarchy, cards with 1px borders and generous but not huge spacing.
- **Mobile is a first-class layout, not a shrunken desktop.** Stack filters into a collapsible panel on small screens, keep touch targets ≥ 40px, avoid horizontal page scroll (only tables and code scroll inside their wrappers), and leave room for the bottom tab bar (the shell adds bottom padding).
- **Accessibility:**
  - Semantic landmarks, one `h1` per page (use `PageHeader`) and labelled controls.
  - Visible focus rings, `aria-current` for active navigation, and `aria-live`/`role="status"` for results.
  - Keyboard-operable everything, and charts that always offer a table view.
- **Integrity in the UI:**
  - Every question shows its origin badge.
  - PYQ difficulty is labelled platform-estimated.
  - Weightage is labelled "historical estimate".
  - Mastery is labelled "Your topic mastery".
  - No fake numbers: with no user data, show an honest empty state that says what to do.
  - Never predict GATE ranks or scores.
- **Performance:** list views virtualise (`@tanstack/react-virtual`) or paginate beyond about 100 rows, questions load on demand, and heavy client pieces are split per route.

## Working conventions (for contributors and agents)

- Verify with `npx tsc --noEmit` and `npx eslint <your files>`. Do **not** run `npm run build`, `npm run dev` or `content:build` in parallel sessions.
- Next 16 allows only **one** `next dev` per checkout, so parallel sessions share one dev server; never kill it. View pages with `node scripts/dev/screenshot.mjs <url> <out.png> <width> <height>`.
- Audit accessibility and responsiveness with `node scripts/dev/a11y-audit.mjs <base-url> [routes…]`. It runs axe-core against WCAG 2.1 A/AA in light and dark themes, and checks horizontal overflow at widths from 320 to 1920 px.
- Do not change shared modules (`src/lib/**`, `src/components/ui/**`, `layout/**`, `question/**`, `charts/**`) unless your task explicitly owns them. Put new components under `src/components/<area>/` and page code under your routes.
- React lint rules are strict (`react-hooks/set-state-in-effect`, `react-hooks/refs`):
  - Derive values during render.
  - Read external stores with `useSyncExternalStore` (see `useStorageValue`) or the Dexie live hooks.
  - Reset per-item state with `key={…}`.
