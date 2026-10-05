import type { ComponentProps } from "react";
import { cn } from "./cn";

/** Selectable date chip ("18 OCT"); the selected one is red. */
export function SlotChip({
  selected = false,
  className,
  ...props
}: ComponentProps<"button"> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "min-w-16 border-2 px-2.5 py-2 text-left text-xs font-bold uppercase leading-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-field text-foreground hover:bg-accent hover:text-accent-foreground",
        className,
      )}
      {...props}
    />
  );
}
