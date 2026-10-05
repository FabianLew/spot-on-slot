import { z } from "zod";
import { SUPPORTED_LOCALES } from "@spot-on-slot/shared";
import { THEMES } from "@/components/theme/theme-provider";

const invalidOption = { error: "validation.invalidOption" };

export const settingsSchema = z.object({
  locale: z.enum(SUPPORTED_LOCALES, invalidOption),
  theme: z.enum(THEMES, invalidOption),
});

export type SettingsValues = z.infer<typeof settingsSchema>;
