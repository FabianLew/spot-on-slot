import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import pl from "../../../messages/pl.json";
import { Audiences } from "./audiences";
import { Faq } from "./faq";
import { Footer } from "./footer";
import { HowItWorks } from "./how-it-works";
import { PrivacyNotice } from "./privacy-notice";

function renderPl(ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale="pl" messages={pl}>
      {ui}
    </NextIntlClientProvider>,
  );
}

afterEach(() => vi.unstubAllEnvs());

describe("Audiences", () => {
  it("renders the heading and the three audience cards", () => {
    const { container } = renderPl(<Audiences />);
    expect(container.querySelector("section#audiences")).toHaveClass("scroll-mt-20");
    expect(screen.getByRole("heading", { level: 2, name: pl.audiences.heading })).toBeInTheDocument();
    for (const key of ["artists", "venues", "bookers"] as const) {
      expect(screen.getByText(pl.audiences[key].title)).toBeInTheDocument();
      expect(screen.getByText(pl.audiences[key].text)).toBeInTheDocument();
    }
  });
});

describe("HowItWorks", () => {
  it("renders the heading and three numbered steps", () => {
    const { container } = renderPl(<HowItWorks />);
    expect(container.querySelector("section#how-it-works")).toHaveClass("scroll-mt-20");
    expect(screen.getByRole("heading", { level: 2, name: pl.howItWorks.heading })).toBeInTheDocument();
    const steps = screen.getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    (["step1", "step2", "step3"] as const).forEach((key, i) => {
      expect(steps[i]).toHaveTextContent(`${i + 1}`);
      expect(steps[i]).toHaveTextContent(`${pl.howItWorks[key].title} ${pl.howItWorks[key].text}`);
    });
  });
});

describe("Faq", () => {
  it("renders six questions with answers inside details elements", () => {
    const { container } = renderPl(<Faq />);
    expect(container.querySelector("section#faq")).toHaveClass("scroll-mt-20");
    expect(screen.getByRole("heading", { level: 2, name: pl.faq.heading })).toBeInTheDocument();
    const items = Object.fromEntries(Object.entries(pl.faq).filter(([key]) => key !== "heading")) as Record<string, { question: string; answer: string }>;
    expect(Object.keys(items)).toHaveLength(6);
    expect(container.querySelectorAll("details")).toHaveLength(6);
    for (const { question, answer } of Object.values(items)) {
      const details = screen.getByText(question).closest("details") as HTMLElement;
      expect(within(details).getByText(answer)).toBeInTheDocument();
    }
  });
});

describe("PrivacyNotice", () => {
  it("shows the controller and e-mail passed in", () => {
    renderPl(<PrivacyNotice controller="Acme sp. z o.o." email="privacy@acme.pl" />);
    const text = screen.getByText(/Administratorem Twoich danych jest/).textContent;
    expect(text).toContain("Acme sp. z o.o.");
    expect(text).toContain("privacy@acme.pl");
    expect(text).not.toContain("{");
    expect(screen.getByRole("link", { name: pl.privacy.policyLink })).toHaveAttribute("href", "/pl/polityka-prywatnosci");
  });
});

describe("Footer", () => {
  it("shows the current year, the controller and a mailto link for a real address", () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVACY_CONTROLLER", "Acme sp. z o.o.");
    vi.stubEnv("NEXT_PUBLIC_PRIVACY_EMAIL", "privacy@acme.pl");
    renderPl(<Footer />);
    expect(screen.getByText(`© ${new Date().getFullYear()} Spot On Slot`)).toBeInTheDocument();
    expect(screen.getByText(/Administrator danych: Acme sp. z o.o./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "privacy@acme.pl" })).toHaveAttribute("href", "mailto:privacy@acme.pl");
  });

  it("renders a placeholder contact as plain text", () => {
    vi.stubEnv("NEXT_PUBLIC_PRIVACY_CONTROLLER", "");
    vi.stubEnv("NEXT_PUBLIC_PRIVACY_EMAIL", "");
    renderPl(<Footer />);
    expect(screen.queryByRole("link", { name: /e-mail kontaktowy/ })).not.toBeInTheDocument();
    expect(screen.getByText(/\[e-mail kontaktowy\]/)).toBeInTheDocument();
  });

  it("links to the privacy policy and the terms in the current locale", () => {
    renderPl(<Footer />);
    expect(screen.getByRole("link", { name: pl.legal.privacy.title })).toHaveAttribute("href", "/pl/polityka-prywatnosci");
    expect(screen.getByRole("link", { name: pl.legal.terms.title })).toHaveAttribute("href", "/pl/regulamin");
  });
});
