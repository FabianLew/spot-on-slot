import type { ComponentProps } from "react";
import { cn } from "./cn";

/** Small bordered label, e.g. a music genre. */
export function Tag({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center border border-border bg-field px-2.5 py-1 text-xs font-bold uppercase leading-none",
        className,
      )}
      {...props}
    />
  );
}
