import type { ReactNode } from "react";
import { cn } from "./cn";

/** Framed title bar ("‹ DJ PROFILE ···"). `back` and `actions` are optional slots (links or buttons). */
export function PageHeader({
  title,
  back,
  actions,
  className,
}: {
  title: ReactNode;
  back?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "grid min-h-12 grid-cols-[2.5rem_1fr_2.5rem] items-center border-2 border-border bg-card px-1",
        className,
      )}
    >
      <div className="flex justify-start">{back}</div>
      <h1 className="font-display truncate text-center text-lg leading-none">{title}</h1>
      <div className="flex justify-end">{actions}</div>
    </header>
  );
}
