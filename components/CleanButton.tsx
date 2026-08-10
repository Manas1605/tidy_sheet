"use client";

interface CleanButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
}

export default function CleanButton({
  onClick,
  disabled,
  loading,
  label = "Clean my data",
}: CleanButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-sm px-5 py-2.5",
        "font-display font-medium text-sm text-paper bg-ink",
        "transition-colors hover:bg-moss disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-ink",
      ].join(" ")}
    >
      {loading && (
        <svg
          className="animate-spin h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path
            className="opacity-90"
            fill="currentColor"
            d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {loading ? "Cleaning…" : label}
    </button>
  );
}
