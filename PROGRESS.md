# Progress

## Status: v1 complete (build order steps 1–10 done, spec re-audited and gaps closed)

## Completed

1. **Scaffold** — `create-next-app` with TypeScript, Tailwind v4, App Router,
   ESLint. Installed `papaparse`, `@types/papaparse`, `groq-sdk`.
2. **`lib/operations.ts`** — all 8 required pure functions
   (`title_case`, `trim_whitespace`, `format_phone_us`, `flag_invalid_email`,
   `extract_zip`, `remove_duplicates`, `lowercase`, `uppercase`), a registry
   (`CELL_OPERATIONS` / `ROW_OPERATIONS` / `OPERATION_DESCRIPTIONS`) used to
   build the AI system prompt, plus `applyPlan()` (executes a validated plan
   against the full dataset) and `validatePlan()` (the safety boundary
   between the AI's raw JSON and what actually runs — see step 5). Tested in
   `lib/operations.test.ts`: 29 assertions, all passing, covering empty
   string / null / undefined / malformed input for every function, plus
   `validatePlan` dropping hallucinated columns/operations and `applyPlan`
   chaining cell ops with a row op.
3. **Static UI shell** — `FileDropzone`, `DataPreviewTable`,
   `InstructionInput`, `CleanButton` components, wired into `app/page.tsx`
   with the full step flow.
4. **Real CSV parsing** — `lib/csvUtils.ts` wraps PapaParse
   (`parseCsvFile`, `rowsToCsv`, `downloadCsv`), enforces the 10MB limit and
   `.csv`-only rule, surfaces parse failures as `CsvParseError`.
5. **`app/api/clean/route.ts`** — calls Groq (`llama-3.3-70b-versatile`,
   JSON mode, `temperature: 0`) with a system prompt built dynamically from
   `OPERATION_DESCRIPTIONS`/`ALL_OPERATION_NAMES`, so the prompt can never
   drift out of sync with what the code supports. The raw plan is passed
   through `validatePlan()` (shared with the test suite) before anything is
   returned to the client — any hallucinated column or operation name is
   silently dropped, never executed or guessed at.
6. **Real instruction -> plan -> execute** — `page.tsx` calls `/api/clean`,
   then runs the validated plan against the *full* parsed dataset in the
   browser via `applyPlan()`.
7. **Before/after view** — `DataPreviewTable` reused with
   `highlightColumns` (moss-green cells that changed) and `isFlagged`
   (rust-colored cells prefixed `INVALID: `).
8. **Download** — "Download cleaned CSV" button via `rowsToCsv` +
   `downloadCsv`, named `<original>_cleaned.csv`.
9. **Error handling** —
   - Bad/oversized/non-CSV upload → inline error, nothing else renders.
   - AI returns `{ error: "unsupported_operation" }` → shown verbatim near
     the Clean button; user can edit the instruction and retry.
   - Groq call throws / times out / network failure → friendly retry-able
     error, button re-enables.
   - Every cell-level transform in `applyPlan` is wrapped in try/catch — a
     bad value is skipped (left unchanged) rather than crashing the run.
   - Missing/placeholder `GROQ_API_KEY` is detected server-side and returns
     a clear setup instruction instead of a raw fetch failure.
10. **Testing against multiple messy CSVs** — `sample-data/` now has 4
    varied hand-crafted files (leads, Shopify orders, recruiter candidates,
    a CRM export — different column names/casing, mixed phone formats,
    malformed emails, addresses to extract zips from, case-insensitive
    duplicates) and `sample-data/pipeline.test.ts` runs a realistic plan
    against each one plus a dedicated "hallucinated plan gets filtered"
    safety scenario. 22 checks, all passing.

## Follow-up fixes (post-review, before final delivery)

After an initial pass, a direct re-check against the spec's file list and
process requirements (section 6, section 12) turned up two gaps, both now
closed:

- **`tailwind.config.ts` was missing.** Tailwind v4 configures itself via
  `@theme` in `app/globals.css` and doesn't strictly require a JS/TS config
  file, but the spec's file list calls for one explicitly, so it's been
  added (content globs only, extensible later for plugins/safelist).
- **Plan validation was inlined in the route handler, untestable in
  isolation.** Extracted into `validatePlan()` in `lib/operations.ts`,
  shared by the route and by `lib/operations.test.ts`, and covered with
  tests that simulate a model hallucinating a column and an operation that
  don't exist.
- **Only one sample CSV had been tested.** Added three more varied files
  and rewrote `sample-data/pipeline.test.ts` to run realistic plans across
  all four, plus the hallucinated-plan safety scenario — 22 checks total,
  all passing. (One early version of the recruiter-candidates fixture had
  a data bug — two "duplicate" rows that weren't actually duplicate emails
  — which the test correctly caught; fixed the fixture, not the code.)

Also re-ran `npx tsc --noEmit` and `npx eslint .` after every change in
this pass: both are clean with zero errors and zero warnings as of this
writing.

## Design

Followed the frontend-design skill's two-pass process. Token system ("the
working sheet"): paper/ink base palette (`#faf9f5` / `#1b1f1c`) instead of
the common cream+terracotta default, a moss green (`#2f6b4f`) for
"cleaned" cells and a rust red (`#b5432f`) for "flagged" cells — the same
two colors the product itself uses in the before/after table, so the
palette *is* the product's own signal system rather than decoration.
Type trio: Space Grotesk (display), Inter (UI text), IBM Plex Mono (all
data cells) — data is deliberately rendered in true monospace so cell
values read as data, not prose, reinforcing the spreadsheet metaphor.
Signature element: a faint fixed grid wash behind the hero, fading out by
the fold, echoing the CSV grid without literally drawing a mock table.

## Deviations from the original spec

- `format_phone_us` also accepts an 11-digit number with a leading `1`
  (US country code) and formats it the same as a bare 10-digit number,
  since that's an extremely common real-world CSV format. Anything else
  non-10-digit still passes through unchanged, per spec.
- Added `validatePlan()` as a named export beyond the literal spec, purely
  to make the AI-response safety check unit-testable — no new dependency,
  no behavior change from what was already happening inline in the route.

## Known issues / untested

- **`npm run build` was not verified end-to-end in this sandbox.** This
  container's network egress is restricted to package registries and does
  not allow `fonts.googleapis.com`, so `next/font/google` (Space Grotesk /
  Inter / IBM Plex Mono) fails to fetch font files during `next build`
  here. `npx tsc --noEmit` and `npx eslint .` both pass cleanly with zero
  errors/warnings, and `next dev`/`next build` will fetch those fonts
  normally on a machine with regular internet access — this is a sandbox
  limitation, not a code issue, but it genuinely has not been exercised
  end-to-end with a real browser. **Recommend running `npm run dev` and
  loading the page as your first step**, before anything else.
- **No real Groq API key was available in this environment**, so
  `app/api/clean/route.ts`'s actual network call to Groq was never
  exercised live — only validated by code review, type-checking, and by
  testing `validatePlan()`/`applyPlan()` (the two functions the route
  depends on) directly with realistic and adversarial inputs.
  **First thing to test locally once you add a real key:** upload
  `sample-data/messy_leads.csv` and try the instruction "Capitalize names,
  remove duplicate rows by email, format phone numbers, flag invalid
  emails, extract zip codes from addresses" — then try something
  deliberately out of scope (e.g. "convert currency to EUR") to confirm
  the unsupported-operation path surfaces correctly in the UI.
- Mobile layout (before/after two-column grid collapses to one column
  under `lg:`) was reviewed in code but not visually verified in a real
  browser/device, since this sandbox has no browser.
