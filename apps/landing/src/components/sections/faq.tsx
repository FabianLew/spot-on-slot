import { useTranslations } from "next-intl";

const ITEMS = ["whatIs", "launch", "price", "roleAndCity", "mobile", "removal"] as const;

export function Faq() {
  const t = useTranslations("faq");

  return (
    <section id="faq" className="scroll-mt-20 bg-background pattern-grid text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
        <h2 className="font-display text-2xl sm:text-3xl">{t("heading")}</h2>
        <div className="mt-10 border-2 border-border bg-card">
          {ITEMS.map((key) => (
            <details key={key} className="group border-b-2 border-border px-5 py-4 last:border-b-0">
              <summary className="flex cursor-pointer list-none gap-3 font-bold marker:hidden [&::-webkit-details-marker]:hidden">
                <span aria-hidden="true" className="font-display text-primary group-open:rotate-45 transition-transform">
                  +
                </span>
                <span>{t(`${key}.question`)}</span>
              </summary>
              <p className="mt-3 pl-7 text-muted-foreground">{t(`${key}.answer`)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
