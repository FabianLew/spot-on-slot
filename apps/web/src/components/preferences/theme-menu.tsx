"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@spot-on-slot/ui";
import { THEMES, type ThemePreference } from "@/components/theme/theme-provider";

function isThemePreference(value: string): value is ThemePreference {
  return THEMES.some((theme) => theme === value);
}

export function ThemeMenu() {
  const t = useTranslations("settings.theme");
  const { theme, setTheme } = useTheme();
  return (
    <>
      <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={theme ?? "system"}
        onValueChange={(value) => {
          if (isThemePreference(value)) setTheme(value);
        }}
      >
        {THEMES.map((value) => (
          <DropdownMenuRadioItem key={value} value={value}>
            {t(value)}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
}
