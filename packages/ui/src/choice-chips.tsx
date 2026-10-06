import { CircleAlert } from "lucide-react";
import { cn } from "./cn";

/**
 * Multiple choice as toggle chips (e.g. genres). The value keeps the order of picking; with {@code max} the
 * unpicked chips are disabled once the limit is reached.
 */
export function ChoiceChips<T extends string>({
  legend,
  options,
  value,
  onChange,
  max,
  hint,
  error,
  className,
}: {
  legend: string;
  options: { value: T; label: string }[];
  value: T[];
  onChange: (value: T[]) => void;
  max?: number;
  hint?: string;
  error?: string;
  className?: string;
}) {
  const full = max !== undefined && value.length >= max;

  function toggle(option: T) {
    onChange(value.includes(option) ? value.filter((picked) => picked !== option) : [...value, option]);
  }

  return (
    <fieldset className={cn("flex flex-col gap-3", className)}>
      <legend className="mb-2 text-sm font-bold uppercase">{legend}</legend>
      {hint && <p className="-mt-1 text-xs text-muted-foreground">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const picked = value.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={picked}
              disabled={!picked && full}
              onClick={() => toggle(option.value)}
              className={cn(
                "border-2 border-border px-3 py-1.5 text-xs font-bold uppercase transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
                picked ? "border-primary bg-primary text-primary-foreground" : "bg-field hover:bg-muted",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-sm text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </fieldset>
  );
}
