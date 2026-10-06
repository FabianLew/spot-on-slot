"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button, Panel, Stepper } from "@spot-on-slot/ui";

/** One wizard step: progress on top, the step in a panel, back/next at the bottom. */
export function WizardFrame({
  steps,
  current,
  title,
  intro,
  children,
  onBack,
  onNext,
  nextLabel,
  busy = false,
  nextDisabled = false,
  footer,
}: {
  steps: string[];
  current: number;
  title: string;
  intro?: string;
  children: ReactNode;
  onBack?: () => void;
  /** Omitted on the last step, whose actions live in {@code footer}. */
  onNext?: () => void;
  nextLabel?: string;
  busy?: boolean;
  nextDisabled?: boolean;
  footer?: ReactNode;
}) {
  const t = useTranslations("onboarding");
  return (
    <div className="flex flex-col gap-6">
      <Stepper steps={steps} current={current} label={t("progress", { current: current + 1, total: steps.length })} />
      <Panel title={title} headingLevel={2}>
        {intro && <p className="text-sm text-muted-foreground">{intro}</p>}
        {children}
      </Panel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {onBack ? (
          <Button type="button" variant="outline" onClick={onBack} disabled={busy}>
            {t("back")}
          </Button>
        ) : (
          <span />
        )}
        {footer ??
          (onNext && (
            <Button type="button" onClick={onNext} disabled={busy || nextDisabled}>
              {busy ? t("saving") : (nextLabel ?? t("next"))}
            </Button>
          ))}
      </div>
    </div>
  );
}
