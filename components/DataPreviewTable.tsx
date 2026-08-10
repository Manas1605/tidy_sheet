"use client";

import type { CsvRow } from "@/lib/csvUtils";

interface DataPreviewTableProps {
  columns: string[];
  rows: CsvRow[];
  maxRows?: number;
  /** Column names whose cells should get the "changed" moss highlight. */
  highlightColumns?: Set<string>;
  /** Cells matching this predicate get the "needs attention" rust highlight. */
  isFlagged?: (value: string) => boolean;
  emptyLabel?: string;
}

export default function DataPreviewTable({
  columns,
  rows,
  maxRows = 15,
  highlightColumns,
  isFlagged,
  emptyLabel = "No rows to show.",
}: DataPreviewTableProps) {
  const visibleRows = rows.slice(0, maxRows);

  if (columns.length === 0) {
    return (
      <div className="border border-line rounded-sm bg-paper-raised px-4 py-6 text-sm text-ink-muted font-data">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="border border-line-strong rounded-sm overflow-hidden bg-paper-raised">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-ink text-paper">
              <th className="sticky left-0 z-10 bg-ink text-paper/50 font-data font-normal text-xs px-3 py-2 text-right w-10 border-r border-ink/40">
                #
              </th>
              {columns.map((col) => (
                <th
                  key={col}
                  scope="col"
                  className="font-sans font-medium text-left px-3 py-2 whitespace-nowrap border-r border-ink/20 last:border-r-0"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className="border-t border-line even:bg-paper hover:bg-moss-soft/40 transition-colors"
              >
                <td className="sticky left-0 z-10 bg-paper-raised text-ink-muted/70 font-data text-xs px-3 py-2 text-right border-r border-line">
                  {rowIdx + 1}
                </td>
                {columns.map((col) => {
                  const value = row[col] ?? "";
                  const flagged = isFlagged ? isFlagged(value) : false;
                  const highlighted = highlightColumns?.has(col) && !flagged;
                  return (
                    <td
                      key={col}
                      className={[
                        "font-data text-[13px] px-3 py-2 border-r border-line last:border-r-0 whitespace-nowrap",
                        flagged ? "bg-rust-soft text-rust" : "",
                        highlighted ? "bg-moss-soft text-moss" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {value === "" ? <span className="text-ink-muted/40">—</span> : value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > maxRows && (
        <div className="px-3 py-2 text-xs text-ink-muted font-data border-t border-line bg-paper">
          Showing {maxRows} of {rows.length} rows.
        </div>
      )}
    </div>
  );
}
