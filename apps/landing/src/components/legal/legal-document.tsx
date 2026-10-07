import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { LocaleSwitch } from "@/components/layout/locale-switch";
import { Footer } from "@/components/sections/footer";
import { Link } from "@/i18n/navigation";
import { getPrivacyConfig } from "@/lib/privacy-config";

/** Bump together with `spotonslot.terms.version` in the backend when the documents change. */
export const LEGAL_VERSION = "2026-10-07";

export type LegalDocumentKind = "privacy" | "terms";

const PATHS = { privacy: "/polityka-prywatnosci", terms: "/regulamin" } as const;

type Section = { heading: string; body: string[] };

/** Body lines starting with "- " become one list; the rest are paragraphs. */
function renderBody(lines: string[], fill: (text: string) => string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let items: string[] = [];
  const flush = () => {
    if (!items.length) return;
    nodes.push(
      <ul key={`list-${nodes.length}`} className="grid list-none gap-2">
        {items.map((item) => (
          <li key={item} className="relative pl-5 before:absolute before:left-0 before:top-[0.6em] before:size-2 before:bg-primary">
            {fill(item)}
          </li>
        ))}
      </ul>,
    );
    items = [];
  };
  for (const line of lines) {
    if (line.startsWith("- ")) {
      items.push(line.slice(2));
      continue;
    }
    flush();
    nodes.push(<p key={`p-${nodes.length}`}>{fill(line)}</p>);
  }
  flush();
  return nodes;
}

export function LegalDocument({ kind }: { kind: LegalDocumentKind }) {
  const t = useTranslations("legal");
  const tHero = useTranslations("hero");
  const format = useFormatter();
  const { controller, email } = getPrivacyConfig();
  // The documents name the controller from the same variables as the waitlist clause and the footer.
  const fill = (text: string) => text.replaceAll("{administrator}", controller).replaceAll("{contact}", email);
  const sections = t.raw(`${kind}.sections`) as Section[];
  const other: LegalDocumentKind = kind === "privacy" ? "terms" : "privacy";
  const isDraft = process.env.LANDING_ENV !== "production";

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b-2 border-border bg-background p-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <svg width="26" height="26" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
            <path d="M 256 256 L 128 256 L 0 128 L 128 128 Z M 256 128 L 128 128 L 0 0 L 128 0 Z" />
          </svg>
          <span className="font-display text-lg">{tHero("brand")}</span>
        </Link>
        <LocaleSwitch className="font-display text-xs text-muted-foreground hover:text-foreground" />
      </header>

      <main className="flex-1 pattern-grid px-4 py-10 sm:px-6 sm:py-16">
        <article className="mx-auto max-w-3xl border-2 border-border bg-card p-6 shadow-lg sm:p-10">
          <h1 className="font-display text-2xl sm:text-4xl">{t(`${kind}.title`)}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("version", { date: format.dateTime(new Date(`${LEGAL_VERSION}T12:00:00Z`), { dateStyle: "long" }) })}
          </p>
          {isDraft && (
            <p className="mt-4 inline-block bg-highlight px-3 py-1 font-display text-xs text-highlight-foreground">
              {t("draftNotice")}
            </p>
          )}
          <p className="mt-6 leading-relaxed">{fill(t(`${kind}.intro`))}</p>

          {sections.map((section) => (
            <section key={section.heading} className="mt-10">
              <h2 className="font-display text-lg sm:text-xl">{section.heading}</h2>
              <div className="mt-4 grid gap-3 leading-relaxed text-foreground/90">{renderBody(section.body, fill)}</div>
            </section>
          ))}

          <div className="mt-12 flex flex-wrap items-center gap-x-4 gap-y-2 border-t-2 border-border pt-6 text-sm">
            <span className="text-muted-foreground">{t("otherDocument")}</span>
            <Link href={PATHS[other]} className="underline underline-offset-4 hover:text-primary">
              {t(`${other}.title`)}
            </Link>
            <Link href="/" className="underline underline-offset-4 hover:text-primary sm:ml-auto">
              {t("back")}
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
