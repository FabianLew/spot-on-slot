"use client";

import { useTranslations } from "next-intl";
import { PixelSquare } from "@spot-on-slot/ui";

/** What the last step says: ready to publish, or the list of what is still missing. */
export function SummaryBody({ missing }: { missing: string[] }) {
  const t = useTranslations("onboarding");
  return (
    <div className="flex flex-col gap-3 text-sm">
      {missing.length === 0 ? (
        <p>{t("summary.ready")}</p>
      ) : (
        <>
          <p className="font-bold">{t("summary.missingTitle")}</p>
          <ul className="flex flex-col gap-1.5">
            {missing.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <PixelSquare className="size-3 shrink-0 text-primary" />
                {t(`missing.${item}` as Parameters<typeof t>[0])}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="text-muted-foreground">{t("summary.later")}</p>
    </div>
  );
}
