"use client";

interface InstructionInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const EXAMPLE =
  "e.g. Capitalize names, remove duplicate rows by email, format phone numbers, flag invalid emails";

export default function InstructionInput({ value, onChange, disabled }: InstructionInputProps) {
  return (
    <div>
      <label htmlFor="instruction" className="block font-display font-medium text-sm text-ink mb-2">
        What should we do to this sheet?
      </label>
      <textarea
        id="instruction"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={EXAMPLE}
        rows={3}
        className={[
          "w-full rounded-sm border border-line-strong bg-paper-raised px-3 py-2.5 text-sm",
          "placeholder:text-ink-muted/60 resize-none",
          "focus:border-moss focus:outline-none focus:ring-2 focus:ring-moss/20",
          disabled ? "opacity-50 cursor-not-allowed" : "",
        ].join(" ")}
      />
      <p className="mt-1.5 text-xs text-ink-muted">
        Plain English is fine — describe casing, duplicates, phone or email formatting, zip codes.
      </p>
    </div>
  );
}
