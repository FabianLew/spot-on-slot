import { Slot } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

/** Dashboard counter ("DJS NEARBY 24"). */
export function StatTile({
  icon,
  label,
  value,
  className,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-28 flex-col justify-between gap-2 border-2 border-border bg-card p-3", className)}>
      {icon && <span aria-hidden="true">{icon}</span>}
      <dl className="flex flex-col gap-1">
        <dt className="text-[0.6875rem] uppercase leading-tight text-muted-foreground">{label}</dt>
        <dd className="font-display text-2xl leading-none">{value}</dd>
      </dl>
    </div>
  );
}

/** Large icon + label action ("POST OPEN SLOT"). Renders a button, or its child with `asChild`. */
export function ActionTile({
  icon,
  asChild = false,
  className,
  children,
  ...props
}: ComponentProps<"button"> & { icon?: ReactNode; asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      className={cn(
        "font-display flex min-h-16 items-center gap-3 border-2 border-border bg-card px-3 py-3 text-left text-sm leading-tight hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      {...props}
    >
      {icon && (
        <span aria-hidden="true" className="shrink-0">
          {icon}
        </span>
      )}
      <Slot.Slottable>{children}</Slot.Slottable>
    </Comp>
  );
}
