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
import { RadioList, type Choice } from "./radio-list";

function useLanguageChoice(): Choice {
  const t = useTranslations("settings.language");
  const locale = useLocale();
  const router = useRouter();
  return {
    label: t("label"),
    value: locale,
    options: SUPPORTED_LOCALES.map((value) => ({ value, label: t(value) })),
    select: async (value) => {
      if (!isLocale(value)) return;
      await setLocale(value);
      router.refresh();
    },
  };
}

export function LanguageMenu() {
  const choice = useLanguageChoice();
  return (
    <>
      <DropdownMenuLabel>{choice.label}</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={choice.value} onValueChange={choice.select}>
        {choice.options.map((option) => (
          <DropdownMenuRadioItem key={option.value} value={option.value}>
            {option.label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
}

export function LanguageRadioList() {
  return <RadioList choice={useLanguageChoice()} />;
}
