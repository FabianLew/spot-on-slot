import { Check } from "lucide-react";
import { cn } from "./cn";

/** Wizard progress: numbered pixel boxes, the current one highlighted. {@code label} reads e.g. "Step 2 of 4". */
export function Stepper({
  steps,
  current,
  label,
  className,
}: {
  steps: string[];
  current: number;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="font-display text-xs uppercase text-muted-foreground">{label}</p>
      <ol
        aria-label={label}
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
        }}
      >
        {steps.map((step, index) => {
          const state = index < current ? "done" : index === current ? "current" : "upcoming";
          return (
            <li
              key={step}
              data-state={state}
              aria-current={state === "current" ? "step" : undefined}
              className="flex min-w-0 flex-col gap-1.5"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-2 border-2 border-border",
                  state === "done" && "bg-heading",
                  state === "current" && "bg-primary border-primary",
                )}
              />
              <span
                className={cn(
                  "flex items-center gap-1 truncate text-xs uppercase",
                  state === "upcoming" ? "text-muted-foreground" : "font-bold",
                )}
              >
                {state === "done" && <Check className="size-3 shrink-0" aria-hidden="true" />}
                <span className="truncate">{step}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
