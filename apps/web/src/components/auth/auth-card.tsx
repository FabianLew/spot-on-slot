import type { ReactNode } from "react";
import { Panel } from "@spot-on-slot/ui";

/** Framed box for the account forms; the page title is the panel's heading. */
export function AuthCard({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <span aria-hidden="true" className="pattern-checker h-3 text-heading dark:text-primary" />
      <Panel className="gap-6 p-6">
        <h1 className="font-display text-3xl leading-none text-heading">{title}</h1>
        {children}
      </Panel>
      {footer && <div className="flex flex-col gap-2 text-sm">{footer}</div>}
    </div>
  );
}

/** Confirmation text after an action (link sent, password changed); announced to screen readers. */
export function AuthNotice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="border-l-4 border-highlight pl-3 text-sm leading-relaxed">
      {children}
    </p>
  );
}

export const authLinkClass =
  "underline underline-offset-4 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
