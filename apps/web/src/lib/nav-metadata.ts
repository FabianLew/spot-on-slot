import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { NavKey } from "@/components/navigation/nav-items";

/** Page metadata for a navigation section: its translated name, wrapped by the root title template. */
export async function navMetadata(key: NavKey): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t(key) };
}
