import type { ReactNode } from "react";
import { cn } from "@spot-on-slot/ui";

/** Stacked "SPOT / ON / SLOT" wordmark with the square from the role-select mockup; `mark` takes the square's place. */
export function Logo({ label, mark, className }: { label: string; mark?: ReactNode; className?: string }) {
  const words = label.split(/\s+/);
  return (
    <span className={cn("flex items-start justify-between gap-3", className)}>
      <span className="font-display flex flex-col text-xl leading-[0.85] text-heading" aria-label={label} role="img">
        {words.map((word) => (
          <span key={word} aria-hidden="true">
            {word}
          </span>
        ))}
      </span>
      {mark ?? <span aria-hidden="true" className="size-9 shrink-0 bg-heading" />}
    </span>
  );
}
