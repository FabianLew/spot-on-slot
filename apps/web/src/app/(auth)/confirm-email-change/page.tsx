import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ConfirmEmailChange } from "@/components/account/confirm-email-change";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("confirmEmail.title") };
}

export default async function Page({ searchParams }: PageProps<"/confirm-email-change">) {
  const { token } = await searchParams;
  return <ConfirmEmailChange token={typeof token === "string" ? token : undefined} />;
}
