# Sheetwork — AI-powered CSV data cleaner

Upload a messy CSV, describe how you want it cleaned in plain English, and
download the result. All file processing happens in your browser — only
column names and a 10-row sample are ever sent to the AI.

## How it works

1. You upload a CSV. It's parsed entirely in the browser with PapaParse.
2. You type an instruction like *"Capitalize names, remove duplicate rows
   by email, format phone numbers, flag invalid emails."*
3. The column names + a small sample of rows + your instruction are sent to
   `/api/clean`, which asks an LLM (via Groq) to pick which **pre-written,
   pre-approved** operations to run on which columns. The AI never writes or
   executes its own code — it only selects from a fixed menu defined in
   `lib/operations.ts`. See the "Why no AI-generated code" note below.
4. The browser applies the returned plan to your **full** dataset (not just
   the sample) and shows a before/after preview.
5. You download the cleaned CSV. Nothing is ever uploaded to or stored on a
   server.

## Setup

```bash
npm install
```

Copy your Groq API key into `.env.local` (a placeholder is already there):

```
GROQ_API_KEY=your_groq_key_here
```

Get a free key (no credit card required) at
[console.groq.com](https://console.groq.com) → API Keys → Create API Key.

Then run the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## What it can clean (v1)

- Title Case / lowercase / UPPERCASE text
- Trim & collapse extra whitespace
- Format US phone numbers as `(XXX) XXX-XXXX`
- Flag invalid email addresses (prefixes bad ones with `INVALID: ` — never
  deletes data)
- Extract a 5-digit US zip code out of a longer address string
- Remove duplicate rows based on a chosen column

If your instruction doesn't map to one of these, the app tells you clearly
instead of guessing.

## Why no AI-generated code

Having an LLM generate and then `eval()`/`exec()` transformation code
directly against your data is a real security risk — especially since CSV
cell values (attacker-controlled text) would flow into that generated code's
context, opening the door to prompt injection. Instead, the AI's only job is
to return a small JSON "plan" (`{ column, operation }` pairs) chosen from a
fixed, hand-written, tested library of functions in `lib/operations.ts`. The
API route also re-validates every column and operation name in that plan
against the real data before anything runs.

## Testing

There's no test runner wired up (out of scope for v1), but two standalone
scripts double as tests:

```bash
npx tsx lib/operations.test.ts        # unit-level checks for every operation + validatePlan
npx tsx sample-data/pipeline.test.ts  # full parse -> validate -> clean -> export, x4 CSVs
```

`sample-data/` has four small hand-crafted messy CSVs (a leads list, a
Shopify-style order export, recruiter candidates, a CRM export) covering
different column names/casing, mixed phone formats, malformed emails,
full addresses to extract zips from, and case-insensitive duplicate rows.
The pipeline test also runs a dedicated safety scenario that simulates the
AI hallucinating a column and an operation that don't exist, and checks
that `validatePlan()` filters them out before anything executes.

## Project structure

```
app/
  api/clean/route.ts    - calls Groq, returns a validated JSON plan or an error
  page.tsx               - orchestrates upload -> instruct -> clean -> download
  layout.tsx, globals.css
lib/
  operations.ts           - the fixed, safe transformation functions + registry
                            + applyPlan() (executes a plan) + validatePlan()
                            (filters an untrusted AI plan against real columns
                            and operations — the safety boundary)
  operations.test.ts       - manual unit tests for every operation + validatePlan
  csvUtils.ts              - PapaParse parse/unparse/download helpers
components/
  FileDropzone.tsx
  DataPreviewTable.tsx
  InstructionInput.tsx
  CleanButton.tsx
sample-data/
  messy_leads.csv, shopify_orders.csv, recruiter_candidates.csv,
  crm_export.csv           - sample files for manual/pipeline testing
  pipeline.test.ts
tailwind.config.ts          - content globs (Tailwind v4 is mainly configured
                              via @theme in app/globals.css; this file is kept
                              explicit for future plugins/overrides)
```

## Known limitations / out of scope for v1

CSV only (no XLSX), no accounts, no saved history, no payments, no
multi-file batch processing, no AI-generated regex or code execution. See
`PROGRESS.md` for the full build log and ideas earmarked for later.
