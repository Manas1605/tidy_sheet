"use client";

import { useCallback, useRef, useState } from "react";

interface FileDropzoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
  selectedFileName?: string | null;
}

export default function FileDropzone({
  onFileSelected,
  disabled,
  selectedFileName,
}: FileDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      onFileSelected(files[0]);
    },
    [onFileSelected]
  );

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
      className={[
        "group cursor-pointer select-none rounded-sm border-2 border-dashed transition-colors",
        "flex flex-col items-center justify-center text-center px-6 py-14",
        disabled ? "opacity-50 cursor-not-allowed" : "",
        isDragOver ? "border-moss bg-moss-soft" : "border-line-strong bg-paper-raised hover:border-moss/60",
      ].join(" ")}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <svg
        aria-hidden="true"
        width="34"
        height="34"
        viewBox="0 0 24 24"
        fill="none"
        className="mb-4 text-ink-muted group-hover:text-moss transition-colors"
      >
        <path
          d="M12 3v12m0-12 4 4m-4-4-4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {selectedFileName ? (
        <>
          <p className="font-data text-sm text-ink">{selectedFileName}</p>
          <p className="mt-1 text-xs text-ink-muted">Drop a different file, or click to browse.</p>
        </>
      ) : (
        <>
          <p className="font-display font-medium text-base text-ink">
            Drop a CSV here, or click to browse
          </p>
          <p className="mt-1 text-xs text-ink-muted">.csv files only, up to 10MB</p>
        </>
      )}
    </div>
  );
}
