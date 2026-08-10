/**
 * lib/csvUtils.ts
 * Thin wrappers around PapaParse so components don't need to know its API.
 */
import Papa from "papaparse";

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB, per spec section 4.1

export type CsvRow = Record<string, string>;

export interface ParsedCsv {
  columns: string[];
  rows: CsvRow[];
}

export class CsvParseError extends Error {}

/**
 * Parses a File into columns + rows. Rejects with a CsvParseError for
 * anything that isn't a usable CSV (wrong extension, too large, no
 * header row, or PapaParse-reported fatal errors).
 */
export function parseCsvFile(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      reject(new CsvParseError("Please upload a .csv file."));
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      reject(new CsvParseError("File is too large. The limit is 10MB."));
      return;
    }
    if (file.size === 0) {
      reject(new CsvParseError("This file is empty."));
      return;
    }

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const fatalErrors = results.errors.filter((e) => e.type !== "FieldMismatch");
        if (fatalErrors.length > 0 && (!results.data || results.data.length === 0)) {
          reject(new CsvParseError("Couldn't parse this file as a CSV. Please check the format."));
          return;
        }
        const columns = results.meta.fields ?? [];
        if (columns.length === 0) {
          reject(new CsvParseError("No columns found. Does the file have a header row?"));
          return;
        }
        resolve({ columns, rows: results.data });
      },
      error: (err: Error) => {
        reject(new CsvParseError(err.message || "Failed to parse CSV."));
      },
    });
  });
}

/** Converts rows back into a CSV string for download. */
export function rowsToCsv(rows: CsvRow[]): string {
  return Papa.unparse(rows);
}

/** Triggers a browser download of a CSV string. No server involved. */
export function downloadCsv(csvString: string, filename: string) {
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
