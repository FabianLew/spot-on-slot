"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { SUPPORTED_LOCALES } from "@spot-on-slot/shared";
import { cn } from "@spot-on-slot/ui";
import { setLocale } from "@/i18n/actions";

/** Compact PL / EN toggle for pages without the app menu. */
export function LocaleSwitch() {
  const t = useTranslations("settings.language");
  const locale = useLocale();
  const router = useRouter();
  return (
    <div role="group" aria-label={t("label")} className="flex border-2 border-border bg-card">
      {SUPPORTED_LOCALES.map((value) => (
        <button
          key={value}
          type="button"
          lang={value}
          aria-pressed={value === locale}
          aria-label={t(value)}
          onClick={async () => {
            await setLocale(value);
            router.refresh();
          }}
          className={cn(
            "font-display min-h-10 min-w-10 px-2 text-sm uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === locale ? "bg-primary text-primary-foreground" : "hover:bg-muted",
          )}
        >
          {value}
        </button>
      ))}
    </div>
  );
}
