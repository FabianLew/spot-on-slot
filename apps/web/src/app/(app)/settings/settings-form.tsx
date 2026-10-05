"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRootError,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@spot-on-slot/ui";
import { SUPPORTED_LOCALES } from "@spot-on-slot/shared";
import { setLocale } from "@/i18n/actions";
import { isLocale } from "@/i18n/locale";
import { THEMES, type ThemePreference } from "@/components/theme/theme-provider";
import { toApiProblem } from "@/lib/api-error";
import { translateFormError } from "@/lib/forms";
import { fallbackMessage } from "@/lib/problem-text";
import { settingsSchema, type SettingsValues } from "./settings-schema";

function toThemePreference(value: string | undefined): ThemePreference {
  return THEMES.find((theme) => theme === value) ?? "system";
}

export function SettingsForm() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      locale: isLocale(locale) ? locale : SUPPORTED_LOCALES[0],
      theme: toThemePreference(theme),
    },
  });

  async function onSubmit(values: SettingsValues) {
    try {
      if (values.locale !== locale) await setLocale(values.locale);
    } catch (error) {
      const problem = toApiProblem(error);
      form.setError("root.server", {
        type: "server",
        message: problem.detail || problem.title || fallbackMessage(t, problem),
      });
      return;
    }
    setTheme(values.theme);
    router.refresh();
    toast.success(t("settings.saved"));
  }

  return (
    <Form {...form} translateError={translateFormError(t)}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid max-w-md gap-6" noValidate>
        <FormField
          control={form.control}
          name="locale"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("settings.language.label")}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {SUPPORTED_LOCALES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`settings.language.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="theme"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("settings.theme.label")}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {THEMES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`settings.theme.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormRootError />
        <div>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {t("settings.save")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
