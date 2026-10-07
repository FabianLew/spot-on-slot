import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import pl from "../../../messages/pl.json";
import { LegalDocument, type LegalDocumentKind } from "./legal-document";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/pl/polityka-prywatnosci",
}));

afterEach(() => vi.unstubAllEnvs());

function renderDocument(kind: LegalDocumentKind, locale: "pl" | "en" = "pl") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "pl" ? pl : en} timeZone="Europe/Warsaw">
      <LegalDocument kind={kind} />
    </NextIntlClientProvider>,
  );
}

describe("LegalDocument", () => {
  it("renders every section of the privacy policy with the controller filled in", () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVACY_CONTROLLER", "Acme sp. z o.o.");
    vi.stubEnv("NEXT_PUBLIC_PRIVACY_EMAIL", "privacy@acme.pl");
    const { container } = renderDocument("privacy");
    expect(screen.getByRole("heading", { level: 1, name: pl.legal.privacy.title })).toBeInTheDocument();
    for (const section of pl.legal.privacy.sections) {
      expect(screen.getByRole("heading", { level: 2, name: section.heading })).toBeInTheDocument();
    }
    const article = container.querySelector("article")!;
    expect(article.textContent).toContain("Administratorem danych jest Acme sp. z o.o.");
    expect(article.textContent).toContain("privacy@acme.pl");
    expect(article.textContent).not.toMatch(/\{(administrator|contact)\}/);
    expect(article.textContent).not.toContain("- ");
  });

  it("turns lines starting with a dash into list items", () => {
    renderDocument("terms");
    const section = screen.getByRole("heading", { level: 2, name: pl.legal.terms.sections[1].heading }).parentElement!;
    expect(within(section).getAllByRole("listitem")).toHaveLength(4);
  });

  it("shows the version date and the draft notice outside production", () => {
    vi.stubEnv("LANDING_ENV", "");
    renderDocument("terms");
    expect(screen.getByText("Wersja z 7 października 2026")).toBeInTheDocument();
    expect(screen.getByText(pl.legal.draftNotice)).toBeInTheDocument();
  });

  it("hides the draft notice in production", () => {
    vi.stubEnv("LANDING_ENV", "production");
    renderDocument("terms");
    expect(screen.queryByText(pl.legal.draftNotice)).not.toBeInTheDocument();
  });

  it("links to the other document and home in English", () => {
    const { container } = renderDocument("privacy", "en");
    const article = within(container.querySelector("article")!);
    expect(article.getByRole("link", { name: en.legal.terms.title })).toHaveAttribute("href", "/en/terms");
    expect(article.getByRole("link", { name: en.legal.back })).toHaveAttribute("href", "/en");
  });
});

describe("LocaleSwitch on a legal page", () => {
  it("goes to the translated address of the same document", () => {
    renderDocument("privacy");
    expect(screen.getByRole("link", { name: pl.nav.switchLocale })).toHaveAttribute("href", "/en/privacy-policy");
  });
});
