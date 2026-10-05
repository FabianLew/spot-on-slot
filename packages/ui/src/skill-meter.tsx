import { cn } from "./cn";

/** Ten-cell bar with a "8/10" readout. The cells are decorative; the meter role carries the value. */
export function SkillMeter({
  label,
  value,
  max = 10,
  className,
}: {
  label: string;
  value: number;
  max?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(max, Math.round(value)));
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={clamped}
      aria-valuetext={`${clamped}/${max}`}
      className={cn("grid grid-cols-[minmax(0,1fr)_auto_2.5rem] items-center gap-2 sm:gap-3 text-xs uppercase", className)}
    >
      <span className="truncate">{label}</span>
      <span aria-hidden="true" className="flex gap-0.5 sm:gap-1">
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            data-filled={i < clamped || undefined}
            className={cn("size-2.5 border border-highlight sm:size-3", i < clamped ? "bg-highlight" : "bg-transparent")}
          />
        ))}
      </span>
      <span aria-hidden="true" className="text-right tabular-nums">
        {clamped}/{max}
      </span>
    </div>
  );
}
