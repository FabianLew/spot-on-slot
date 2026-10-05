import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

/** Framed section from the arcade mockups: a bordered box with an optional pixel heading. */
export function Panel({
  title,
  action,
  headingLevel = 2,
  className,
  children,
  ...props
}: Omit<ComponentProps<"section">, "title"> & {
  title?: ReactNode;
  action?: ReactNode;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section
      className={cn("flex flex-col gap-4 border-2 border-border bg-card p-4 text-card-foreground", className)}
      {...props}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-3">
          {title && <Heading className="font-display text-lg leading-none">{title}</Heading>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Section label above a group of panels or tiles ("TODAY", "OPEN SLOTS"). */
export function SectionTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 className={cn("font-display text-base leading-none", className)} {...props} />;
}
