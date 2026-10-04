import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

const variants = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  secondary: "bg-secondary text-secondary-foreground hover:opacity-90",
  outline: "border border-border bg-transparent hover:bg-muted",
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
}

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md px-5 py-2.5 text-sm font-semibold transition disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
