/**
 * lib/operations.ts
 * ------------------------------------------------------------------------
 * A fixed library of safe, hand-written, pure transformation functions.
 *
 * SECURITY NOTE: The AI model NEVER writes or executes transformation logic.
 * It only ever SELECTS operation names from OPERATION_REGISTRY below (see
 * app/api/clean/route.ts). This file is the only place actual data
 * mutation happens, so every function here must be defensive: never throw,
 * never eval/exec/Function() anything, and always fall back to returning
 * the original value untouched if it can't confidently process the input.
 * ------------------------------------------------------------------------
 */

/** Safely coerce a CSV cell value to a string for text operations. */
function toSafeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return String(value);
  } catch {
    return "";
  }
}

/**
 * 1. title_case
 * Converts text to Title Case (first letter of each word capitalized).
 */
export function title_case(value: unknown): string {
  const str = toSafeString(value);
  if (!str) return str;
  try {
    return str
      .toLowerCase()
      .replace(/(^|\s|-|')([a-z])/g, (_match, boundary: string, letter: string) => {
        return `${boundary}${letter.toUpperCase()}`;
      });
  } catch {
    return str;
  }
}

/**
 * 2. trim_whitespace
 * Removes leading/trailing whitespace and collapses internal multiple
 * spaces down to a single space.
 */
export function trim_whitespace(value: unknown): string {
  const str = toSafeString(value);
  if (!str) return str;
  try {
    return str.trim().replace(/\s+/g, " ");
  } catch {
    return str;
  }
}

/**
 * 3. format_phone_us
 * Strips non-digit characters and formats a 10-digit US number as
 * "(XXX) XXX-XXXX". If the result isn't exactly 10 digits (e.g.
 * missing digits, international numbers, extensions), the original
 * value is returned unchanged rather than guessed at.
 */
export function format_phone_us(value: unknown): string {
  const str = toSafeString(value);
  if (!str) return str;
  try {
    const digits = str.replace(/\D/g, "");
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    // Handle common "1" country-code prefix, e.g. "1-555-123-4567"
    if (digits.length === 11 && digits.startsWith("1")) {
      const d = digits.slice(1);
      return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    }
    return str;
  } catch {
    return str;
  }
}

/**
 * 4. flag_invalid_email
 * Validates against a standard email regex. Invalid values are prefixed
 * with "INVALID: " so the user can spot them — nothing is deleted or
 * silently altered.
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function flag_invalid_email(value: unknown): string {
  const str = toSafeString(value);
  if (!str.trim()) return str;
  try {
    if (EMAIL_REGEX.test(str.trim())) {
      return str;
    }
    if (str.startsWith("INVALID: ")) return str; // avoid double-flagging
    return `INVALID: ${str}`;
  } catch {
    return str;
  }
}

/**
 * 5. extract_zip
 * Extracts a 5-digit US zip code from a longer string (e.g. a full
 * address). Returns an empty string if none is found.
 */
export function extract_zip(value: unknown): string {
  const str = toSafeString(value);
  if (!str) return "";
  try {
    const match = str.match(/\b\d{5}(?:-\d{4})?\b/);
    return match ? match[0].slice(0, 5) : "";
  } catch {
    return "";
  }
}

/**
 * 6. remove_duplicates
 * Removes rows with a duplicate value in the specified column, keeping
 * only the first occurrence. Operates on the full row array (not a
 * single cell), since it needs cross-row context.
 */
export function remove_duplicates(
  rows: Record<string, unknown>[],
  column: string
): Record<string, unknown>[] {
  if (!Array.isArray(rows)) return rows;
  try {
    const seen = new Set<string>();
    const result: Record<string, unknown>[] = [];
    for (const row of rows) {
      const raw = row && Object.prototype.hasOwnProperty.call(row, column) ? row[column] : undefined;
      const key = toSafeString(raw).trim().toLowerCase();
      // Rows with an empty key (missing/blank value) are always kept —
      // we only dedupe on genuinely matching non-empty values.
      if (key === "" || !seen.has(key)) {
        if (key !== "") seen.add(key);
        result.push(row);
      }
    }
    return result;
  } catch {
    return rows;
  }
}

/**
 * 7. lowercase
 */
export function lowercase(value: unknown): string {
  const str = toSafeString(value);
  try {
    return str.toLowerCase();
  } catch {
    return str;
  }
}

/**
 * 8. uppercase
 */
export function uppercase(value: unknown): string {
  const str = toSafeString(value);
  try {
    return str.toUpperCase();
  } catch {
    return str;
  }
}

/* --------------------------------------------------------------------- */
/* Registry: single source of truth for which operations exist, used by  */
/* both the API route (to build the AI system prompt) and the client     */
/* (to actually execute a plan against the full dataset).                */
/* --------------------------------------------------------------------- */

export type CellOperationName =
  | "title_case"
  | "trim_whitespace"
  | "format_phone_us"
  | "flag_invalid_email"
  | "extract_zip"
  | "lowercase"
  | "uppercase";

export type RowOperationName = "remove_duplicates";

export type OperationName = CellOperationName | RowOperationName;

export const CELL_OPERATIONS: Record<CellOperationName, (value: unknown) => string> = {
  title_case,
  trim_whitespace,
  format_phone_us,
  flag_invalid_email,
  extract_zip,
  lowercase,
  uppercase,
};

export const ROW_OPERATIONS: Record<
  RowOperationName,
  (rows: Record<string, unknown>[], column: string) => Record<string, unknown>[]
> = {
  remove_duplicates,
};

/**
 * Human-readable descriptions used to build the AI system prompt. Keeping
 * this next to the registry means the prompt can never drift out of sync
 * with what actually exists in code.
 */
export const OPERATION_DESCRIPTIONS: Record<OperationName, string> = {
  title_case: "Convert text to Title Case (e.g. 'john smith' -> 'John Smith').",
  trim_whitespace: "Remove leading/trailing whitespace and collapse multiple spaces into one.",
  format_phone_us:
    "Format a 10-digit US phone number as '(XXX) XXX-XXXX'. Leaves the value unchanged if it isn't a valid 10-digit US number.",
  flag_invalid_email:
    "Validate an email address; if invalid, prefix the value with 'INVALID: ' (never deletes or silently changes it).",
  extract_zip: "Extract a 5-digit US zip code from a longer string like a full address.",
  lowercase: "Convert text to all lowercase.",
  uppercase: "Convert text to all uppercase.",
  remove_duplicates:
    "Remove rows with a duplicate value in a given column, keeping only the first occurrence. This is a row-level (not cell-level) operation.",
};

export interface PlanStep {
  column: string;
  operation: OperationName;
}

export interface ApplyPlanResult {
  rows: Record<string, unknown>[];
  /** Columns that had at least one cell-level operation applied — used to
   * highlight what changed in the before/after preview. */
  changedColumns: Set<string>;
}

/**
 * Applies a validated plan (array of { column, operation }) to the full
 * dataset. Cell-level operations run per-row/per-column; row-level
 * operations (currently just remove_duplicates) run against the whole
 * row set. Every individual cell transform is wrapped in try/catch so one
 * bad value can never crash the whole run — it's just left unchanged.
 */
export function applyPlan(
  rows: Record<string, unknown>[],
  plan: PlanStep[]
): ApplyPlanResult {
  let workingRows = rows.map((row) => ({ ...row }));
  const changedColumns = new Set<string>();

  for (const step of plan) {
    const cellFn = CELL_OPERATIONS[step.operation as CellOperationName];
    const rowFn = ROW_OPERATIONS[step.operation as RowOperationName];

    if (cellFn) {
      changedColumns.add(step.column);
      workingRows = workingRows.map((row) => {
        try {
          if (!Object.prototype.hasOwnProperty.call(row, step.column)) return row;
          return { ...row, [step.column]: cellFn(row[step.column]) };
        } catch {
          return row; // skip this row's cell on failure, keep original value
        }
      });
    } else if (rowFn) {
      try {
        workingRows = rowFn(workingRows, step.column);
      } catch {
        // If the row-level operation fails outright, leave rows untouched.
      }
    }
    // Unknown operation names are ignored defensively (should never
    // happen since the API route already validates against this registry).
  }

  return { rows: workingRows, changedColumns };
}

/**
 * Validates a raw, untrusted plan (as returned by the AI) against the
 * real column names for this dataset and the real operation registry.
 * Any step referencing a column or operation that doesn't actually exist
 * is silently dropped rather than executed or guessed at — this is the
 * safety boundary between "what the model said" and "what actually runs."
 *
 * Shared by the API route (server-side validation of the AI's response)
 * and its tests, so the two can never drift apart.
 */
export function validatePlan(rawPlan: unknown, columns: string[]): PlanStep[] {
  if (!Array.isArray(rawPlan)) return [];
  const columnSet = new Set(columns);
  const operationSet = new Set<string>(ALL_OPERATION_NAMES);
  const validated: PlanStep[] = [];

  for (const step of rawPlan) {
    if (
      step &&
      typeof step === "object" &&
      typeof (step as Record<string, unknown>).column === "string" &&
      typeof (step as Record<string, unknown>).operation === "string" &&
      columnSet.has((step as Record<string, unknown>).column as string) &&
      operationSet.has((step as Record<string, unknown>).operation as string)
    ) {
      validated.push({
        column: (step as Record<string, unknown>).column as string,
        operation: (step as Record<string, unknown>).operation as OperationName,
      });
    }
  }

  return validated;
}

export const ALL_OPERATION_NAMES: OperationName[] = [
  "title_case",
  "trim_whitespace",
  "format_phone_us",
  "flag_invalid_email",
  "extract_zip",
  "lowercase",
  "uppercase",
  "remove_duplicates",
];
