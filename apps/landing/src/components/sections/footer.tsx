import { useTranslations } from "next-intl";
import { getPrivacyConfig } from "@/lib/privacy-config";

export function Footer() {
  const t = useTranslations("footer");
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
    <footer className="border-t border-border bg-background text-muted-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 py-8 text-sm">
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
