import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getPrivacyConfig } from "@/lib/privacy-config";

export function Footer() {
  const t = useTranslations("footer");
  const tLegal = useTranslations("legal");
  const { controller, email } = getPrivacyConfig();
  // The contact may be a link, so split the template around it instead of interpolating a string.
  const [before, after] = (t.raw("controller") as string).split("{contact}");
  const contact = email.includes("@") ? (
    <a href={`mailto:${email}`} className="underline underline-offset-2 hover:text-foreground">
      {email}
    </a>
  ) : (
    email
  );

  return (
    <footer className="border-t-2 border-border bg-background text-muted-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 py-8 text-sm">
        <nav aria-label={t("legalNav")} className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/polityka-prywatnosci" className="underline underline-offset-2 hover:text-foreground">
            {tLegal("privacy.title")}
          </Link>
          <Link href="/regulamin" className="underline underline-offset-2 hover:text-foreground">
            {tLegal("terms.title")}
          </Link>
        </nav>
        <p>{t("copyright", { year: new Date().getFullYear() })}</p>
        <p>
          {before.replace("{administrator}", controller)}
          {contact}
          {after}
        </p>
      </div>
    </footer>
  );
}
