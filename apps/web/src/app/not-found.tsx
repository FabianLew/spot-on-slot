import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@spot-on-slot/ui";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-start justify-center gap-3 px-4 py-16">
      <h1 className="text-2xl font-bold">{t("notFoundTitle")}</h1>
      <p className="text-muted-foreground">{t("notFoundText")}</p>
      <Link href="/dashboard" className={buttonVariants()}>
        {t("backToDashboard")}
      </Link>
    </main>
  );
}
