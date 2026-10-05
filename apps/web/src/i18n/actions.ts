"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import type { Locale } from "@spot-on-slot/shared";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, isLocale } from "./locale";

export async function setLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) {
    throw new Error(`Unsupported locale: ${String(locale)}`);
  }
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
    path: "/",
  });
  revalidatePath("/", "layout");
}
