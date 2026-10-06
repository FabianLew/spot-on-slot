import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants, Panel } from "@spot-on-slot/ui";

export default async function NotFound() {
  const t = await getTranslations("artistProfile.public");
  return (
    <Panel className="w-full max-w-md items-start self-center">
      <p aria-hidden="true" className="font-display text-5xl leading-none text-primary">
        404
      </p>
      <h1 className="font-display text-xl leading-tight">{t("notFoundTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("notFoundText")}</p>
      <Link href="/" className={buttonVariants()}>
        {t("home")}
      </Link>
    </Panel>
  );
}
