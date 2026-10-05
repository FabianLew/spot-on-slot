"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@spot-on-slot/ui";
import { THEMES, type ThemePreference } from "@/components/theme/theme-provider";
import { RadioList, type Choice } from "./radio-list";

function isThemePreference(value: string): value is ThemePreference {
  return THEMES.some((theme) => theme === value);
}

function useThemeChoice(): Choice {
  const t = useTranslations("settings.theme");
  const { theme, setTheme } = useTheme();
  return {
    label: t("label"),
    value: theme ?? "system",
    options: THEMES.map((value) => ({ value, label: t(value) })),
    select: (value) => {
      if (isThemePreference(value)) setTheme(value);
    },
  };
}

export function ThemeMenu() {
  const choice = useThemeChoice();
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

export function ThemeRadioList() {
  return <RadioList choice={useThemeChoice()} />;
}
