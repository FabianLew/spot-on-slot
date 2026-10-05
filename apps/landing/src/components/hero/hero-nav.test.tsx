import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import pl from "../../../messages/pl.json";
import { HeroNav } from "./hero-nav";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/pl",
}));

function renderNav() {
  return render(
    <NextIntlClientProvider locale="pl" messages={pl}>
      <HeroNav />
    </NextIntlClientProvider>,
  );
}

describe("HeroNav", () => {
  it("shows the brand and the section pill with the active item highlighted", () => {
    renderNav();
    expect(screen.getByText(pl.hero.brand)).toHaveClass("font-playfair italic");
    const pill = screen.getByRole("navigation").querySelector("div.md\\:flex") as HTMLElement;
    const links = within(pill).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "#audiences",
      "#how-it-works",
      "#waitlist",
      "#faq",
    ]);
    expect(within(pill).getByRole("link", { name: pl.nav.audiences })).toHaveClass("bg-white text-gray-900");
    expect(within(pill).getByRole("link", { name: pl.nav.faq })).not.toHaveClass("bg-white");
  });

  it("links the desktop CTA to the waitlist and offers the other locale", () => {
    renderNav();
    expect(screen.getByRole("link", { name: pl.nav.join })).toHaveAttribute("href", "#waitlist");
    expect(screen.getByRole("link", { name: pl.nav.switchLocale })).toHaveAttribute("href", "/en");
  });

  it("opens a menu sheet with the sections and the locale switch", async () => {
    const user = userEvent.setup();
    renderNav();
    await user.click(screen.getByRole("button", { name: pl.nav.menu }));

    const sheet = await screen.findByRole("dialog");
    const sections = within(sheet).getAllByRole("link").filter((link) => link.getAttribute("href")?.startsWith("#"));
    expect(sections.map((link) => link.textContent)).toEqual([
      pl.nav.audiences,
      pl.nav.howItWorks,
      pl.nav.waitlist,
      pl.nav.faq,
    ]);
    expect(within(sheet).getByRole("link", { name: pl.nav.switchLocale })).toHaveAttribute("href", "/en");
    expect(within(sheet).getByRole("button", { name: pl.nav.closeMenu })).toBeInTheDocument();
    // The nav sinks below the sheet overlay so the overlay dims it.
    expect(document.querySelector("nav")).toHaveClass("z-40");
  });

  it("closes the sheet after choosing a section", async () => {
    const user = userEvent.setup();
    renderNav();
    await user.click(screen.getByRole("button", { name: pl.nav.menu }));
    const sheet = await screen.findByRole("dialog");
    await user.click(within(sheet).getByRole("link", { name: pl.nav.faq }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
