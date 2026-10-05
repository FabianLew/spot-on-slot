"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { SUPPORTED_LOCALES } from "@spot-on-slot/shared";
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@spot-on-slot/ui";
import { setLocale } from "@/i18n/actions";
import { isLocale } from "@/i18n/locale";

export function LanguageMenu() {
  const t = useTranslations("settings.language");
  const locale = useLocale();
  const router = useRouter();
  return (
    <>
      <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={locale}
        onValueChange={async (value) => {
          if (!isLocale(value)) return;
          await setLocale(value);
          router.refresh();
        }}
      >
        {SUPPORTED_LOCALES.map((value) => (
          <DropdownMenuRadioItem key={value} value={value}>
            {t(value)}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
}
