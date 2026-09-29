# GATE DA Mastery

A preparation platform for the **GATE Data Science & Artificial Intelligence (DA)** paper. It includes:

- official previous-year questions with independently verified, step-by-step solutions;
- 50 progressive mock tests with a full-screen exam mode;
- a formula book, a concept library and exam strategy guides;
- spaced revision, an error log and progress analytics.

**Accuracy is the priority.** Every official fact carries its source and a verification status, and every question shows whether it is an **Official PYQ**, **Original practice** or a **Mock test** question. See `/sources` in the app and `docs/content-authoring.md`.

## Quick start

```bash
# Node.js >= 20.9 (22 LTS recommended)
npm install
npm run dev            # compiles content, then starts http://localhost:3000
```

Production:

```bash
npm run build          # content:build + next build
npm start              # next start (PORT env var supported)
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Compile content, start the dev server |
| `npm run build` | Compile content and build the production app |
| `npm start` | Serve the production build |
| `npm run content:build` | Validate + compile `content/` → `generated/content.json` |
| `npm run content:validate` | Validate only (exit 1 on any error) |
| `npm run content:audit` | Write `reports/content-audit.{md,json}` (add `-- --strict` to fail when not publishable) |
| `npm run sources:verify` | Hash official files from the official hosts and compare with recorded SHA-256 (add `-- --write` to upgrade matches to VERIFIED) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | Unit + integration tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright, desktop + mobile; needs `npm run build` first) |
| `npx tsx scripts/content/validate-file.ts <file>` | Validate one content file |

## Deployment

The app is a standard Next.js server application. The compiled content bundle (`generated/content.json`) is created at build time and read from disk at runtime (`next.config.ts` includes it in output tracing).

- **Vercel:** import the repository; the defaults work (the build command is `npm run build`, output is Next.js). Use Node 20 or 22.
- **Any Node host / Docker:** run `npm ci && npm run build`, then `npm start` behind a reverse proxy. The server needs no database, secrets or environment variables.
- **Health check:** `GET /api/health`.

User progress (attempts, mocks, bookmarks, revision, error log) is stored **locally in the browser** (IndexedDB). Students can export and import a JSON backup from Settings. There is no account system, because no authentication provider or hosted database was configured for this project. See `docs/architecture.md` for how a sync backend would plug in.

Optional environment variable:

- `ADMIN_ENABLED=true`: enables the `/admin` content-management screens in production. They are always enabled in development. The admin API writes to `content/`, so enable it only on a trusted, non-public instance.

## Content model and verification

- `content/` is the source of truth. It is reviewed through git and validated by Zod schemas and semantic checks. The checks cover: key/answer agreement, taxonomy consistency, marks structure, duplicate detection, figure existence, source references and exam-date sanity.
- Official PYQs are transcribed from the official master question papers. Answers come from the official answer keys, and the parsed key tables are committed in `content/exam/official-keys.json` so every PYQ is cross-checked against them.
- Each solution is written by one agent and independently re-solved **blind** (before looking at the key) by another. Any disagreement with the official key is kept visible as `NEEDS_REVIEW`; the official answer is never silently changed.
- Mock and practice questions are original. Each is checked computationally by its author and blind re-solved by an independent verifier.
- `npm run content:audit` reports verified and needs-review counts, missing solutions, duplicates, syllabus coverage and source status.

The file bytes of official papers and keys were obtained from public mirrors whose SHA-256 hashes agree across two independent repositories, because the official GATE hosts were unreachable from the build environment. Run `npm run sources:verify` from an unrestricted network to confirm byte-identity with the official hosts.

## Copyright

Official GATE question papers and answer keys are the property of their respective organizing institutes (IISc Bengaluru, IIT Roorkee, IIT Guwahati, IIT Madras). They are reproduced here for educational reference, with attribution and links to the official sources. Solutions, explanations and all mock and practice questions are original content of this project. This project is not affiliated with GATE, IISc or any IIT.

## Project documentation

- `docs/architecture.md`: stack, data flow, modules and conventions
- `docs/content-authoring.md`: content rules, verification protocol and difficulty rubric
- `reports/content-audit.md`: the latest content audit
