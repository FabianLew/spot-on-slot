import { useTranslations } from "next-intl";

const ITEMS = ["whatIs", "launch", "price", "roleAndCity", "mobile", "removal"] as const;

export function Faq() {
  const t = useTranslations("faq");

  return (
    <section id="faq" className="scroll-mt-20 bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("heading")}</h2>
        <div className="mt-10 border-t border-border">
          {ITEMS.map((key) => (
            <details key={key} className="group border-b border-border py-4">
              <summary className="cursor-pointer list-none font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                {t(`${key}.question`)}
              </summary>
              <p className="mt-3 text-muted-foreground">{t(`${key}.answer`)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
