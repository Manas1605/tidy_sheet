"use client";

import { useCallback, useMemo, useState } from "react";
import FileDropzone from "@/components/FileDropzone";
import DataPreviewTable from "@/components/DataPreviewTable";
import InstructionInput from "@/components/InstructionInput";
import CleanButton from "@/components/CleanButton";
import {
  CsvParseError,
  downloadCsv,
  parseCsvFile,
  rowsToCsv,
  type CsvRow,
  type ParsedCsv,
} from "@/lib/csvUtils";
import { applyPlan, type PlanStep } from "@/lib/operations";

type Status = "idle" | "ready" | "cleaning" | "done";

interface CleanApiSuccess {
  plan: PlanStep[];
}
interface CleanApiError {
  error: "unsupported_operation";
  message: string;
}
type CleanApiResponse = CleanApiSuccess | CleanApiError;

export default function Home() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [instruction, setInstruction] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [cleanError, setCleanError] = useState<string | null>(null);
  const [cleanedRows, setCleanedRows] = useState<CsvRow[] | null>(null);
  const [changedColumns, setChangedColumns] = useState<Set<string>>(new Set());

  const handleFileSelected = useCallback(async (file: File) => {
    setUploadError(null);
    setCleanError(null);
    setCleanedRows(null);
    setStatus("idle");
    try {
      const result = await parseCsvFile(file);
      setParsed(result);
      setFileName(file.name);
      setStatus("ready");
    } catch (err) {
      setParsed(null);
      setFileName(null);
      setUploadError(err instanceof CsvParseError ? err.message : "Couldn't read that file.");
    }
  }, []);

  const handleClean = useCallback(async () => {
    if (!parsed || !instruction.trim()) return;
    setStatus("cleaning");
    setCleanError(null);
    try {
      const res = await fetch("/api/clean", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          columns: parsed.columns,
          sampleRows: parsed.rows.slice(0, 10),
          instruction,
        }),
      });

      if (!res.ok && res.status >= 500) {
        setCleanError("The cleaning service is unavailable right now. Please try again in a moment.");
        setStatus("ready");
        return;
      }

      const data: CleanApiResponse = await res.json();

      if ("error" in data) {
        setCleanError(data.message);
        setStatus("ready");
        return;
      }

      const { rows, changedColumns: changed } = applyPlan(parsed.rows, data.plan);
      setCleanedRows(rows as CsvRow[]);
      setChangedColumns(changed);
      setStatus("done");
    } catch {
      setCleanError("Couldn't reach the cleaning service — check your connection and try again.");
      setStatus("ready");
    }
  }, [parsed, instruction]);

  const handleDownload = useCallback(() => {
    if (!cleanedRows) return;
    const csv = rowsToCsv(cleanedRows);
    const base = fileName?.replace(/\.csv$/i, "") ?? "data";
    downloadCsv(csv, `${base}_cleaned.csv`);
  }, [cleanedRows, fileName]);

  const isInvalidEmailCell = useMemo(
    () => (value: string) => value.startsWith("INVALID: "),
    []
  );

  return (
    <div className="relative min-h-full">
      <div className="grid-wash pointer-events-none absolute inset-0 h-[480px]" />

      <header className="relative border-b border-line px-6 py-5">
        <div className="mx-auto max-w-4xl flex items-baseline justify-between">
          <div>
            <p className="font-display font-bold text-lg tracking-tight text-ink">Sheetwork</p>
          </div>
          <p className="hidden sm:block text-xs text-ink-muted font-data">csv in, clean csv out</p>
        </div>
      </header>

      <main className="relative mx-auto max-w-4xl px-6 py-10 flex-1 w-full">
        <section className="mb-10">
          <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight text-ink max-w-2xl">
            Describe the mess. Get back a clean sheet.
          </h1>
          <p className="mt-3 text-ink-muted max-w-xl leading-relaxed">
            Upload a messy CSV, tell it what to fix in plain English, and download the result.
            No formulas, no Find &amp; Replace, no copy-pasting into a chat window.
          </p>
        </section>

        {/* Step 1: Upload */}
        <section className="mb-3">
          <StepLabel n={1} title="Upload your CSV" />
        </section>
        <section className="mb-8">
          <FileDropzone
            onFileSelected={handleFileSelected}
            disabled={status === "cleaning"}
            selectedFileName={fileName}
          />
          {uploadError && <ErrorNote>{uploadError}</ErrorNote>}
        </section>

        {parsed && (
          <>
            {/* Step 2: Peek at raw data */}
            <section className="mb-3">
              <StepLabel n={2} title="Here's what came in" />
            </section>
            <section className="mb-10">
              <DataPreviewTable columns={parsed.columns} rows={parsed.rows} />
            </section>

            {/* Step 3 & 4: Instruction + clean button */}
            <section className="mb-3">
              <StepLabel n={3} title="What should we fix?" />
            </section>
            <section className="mb-10 bg-paper-raised border border-line rounded-sm p-5">
              <InstructionInput
                value={instruction}
                onChange={setInstruction}
                disabled={status === "cleaning"}
              />
              <div className="mt-4 flex items-center gap-3">
                <CleanButton
                  onClick={handleClean}
                  disabled={!instruction.trim()}
                  loading={status === "cleaning"}
                />
                {status === "done" && (
                  <span className="text-xs text-moss font-data">✓ cleaned {cleanedRows?.length ?? 0} rows</span>
                )}
              </div>
              {cleanError && <ErrorNote>{cleanError}</ErrorNote>}
            </section>
          </>
        )}

        {/* Step 5 & 6: Before/after + download */}
        {status === "done" && cleanedRows && parsed && (
          <>
            <section className="mb-3">
              <StepLabel n={4} title="Before & after" />
            </section>
            <section className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <p className="mb-2 text-xs font-data uppercase tracking-wide text-ink-muted">Before</p>
                <DataPreviewTable columns={parsed.columns} rows={parsed.rows} maxRows={20} />
              </div>
              <div>
                <p className="mb-2 text-xs font-data uppercase tracking-wide text-moss">After</p>
                <DataPreviewTable
                  columns={parsed.columns}
                  rows={cleanedRows}
                  maxRows={20}
                  highlightColumns={changedColumns}
                  isFlagged={isInvalidEmailCell}
                />
              </div>
            </section>
            <section className="mb-16">
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-2 rounded-sm px-5 py-2.5 font-display font-medium text-sm text-ink border border-ink hover:bg-ink hover:text-paper transition-colors"
              >
                Download cleaned CSV
              </button>
            </section>
          </>
        )}
      </main>

      <footer className="relative border-t border-line px-6 py-5">
        <p className="mx-auto max-w-4xl text-xs text-ink-muted">
          All processing happens in your browser. Only column names and a small sample of rows are
          sent to the AI to plan the cleanup — never your full file.
        </p>
      </footer>
    </div>
  );
}

function StepLabel({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-data text-xs text-ink-muted border border-line-strong rounded-full w-5 h-5 flex items-center justify-center">
        {n}
      </span>
      <h2 className="font-display font-medium text-sm text-ink">{title}</h2>
    </div>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-sm text-rust bg-rust-soft border border-rust/20 rounded-sm px-3 py-2">
      {children}
    </p>
  );
}
