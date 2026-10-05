import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import pl from "../../../messages/pl.json";
import { HERO_SECTION_ID } from "./hero.config";
import { HeroNav } from "./hero-nav";
import { mockIntersectionObserver } from "./test-intersection-observer";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/pl",
}));

function renderNav() {
  return render(
    <NextIntlClientProvider locale="pl" messages={pl}>
      <HeroNav />
      <section id={HERO_SECTION_ID} />
    </NextIntlClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

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

  describe("background after the hero", () => {
    it("stays transparent over the hero and turns solid once the hero leaves the viewport", () => {
      const io = mockIntersectionObserver();
      renderNav();
      const nav = screen.getByRole("navigation");
      const hero = document.getElementById(HERO_SECTION_ID)!;
      const pill = nav.querySelector("div.md\\:flex") as HTMLElement;
      const menuIcon = screen.getByRole("button", { name: pl.nav.menu }).querySelector("svg")!;

      expect(io.observers.some((o) => o.targets.includes(hero))).toBe(true);
      expect(nav).toHaveAttribute("data-over-hero", "true");
      expect(nav).not.toHaveClass("bg-background/95");
      expect(pill).toHaveClass("bg-white/20 backdrop-blur-md");
      expect(screen.getByText(pl.hero.brand)).toHaveClass("text-white");
      expect(menuIcon).toHaveClass("text-white");

      act(() => io.setIntersecting(hero, false));
      expect(nav).toHaveAttribute("data-over-hero", "false");
      expect(nav).toHaveClass("bg-background/95 text-foreground border-b");
      expect(pill).toHaveClass("bg-muted");
      expect(pill).not.toHaveClass("bg-white/20");
      expect(within(pill).getByRole("link", { name: pl.nav.audiences })).toHaveClass("bg-foreground text-background");
      expect(screen.getByText(pl.hero.brand)).toHaveClass("text-foreground");
      expect(menuIcon).toHaveClass("text-foreground");
      expect(screen.getByRole("link", { name: pl.nav.join })).toHaveClass("bg-primary");

      act(() => io.setIntersecting(hero, true));
      expect(nav).toHaveAttribute("data-over-hero", "true");
      expect(nav).not.toHaveClass("bg-background/95");
    });

    it("treats the hero as left once it no longer reaches below the nav bar", () => {
      const io = mockIntersectionObserver();
      renderNav();
      const hero = document.getElementById(HERO_SECTION_ID)!;
      const observer = io.observers.find((o) => o.targets.includes(hero));
      expect(observer?.options?.rootMargin).toBe("-80px 0px 0px 0px");
    });

    it("stops observing on unmount", () => {
      const io = mockIntersectionObserver();
      const { unmount } = renderNav();
      unmount();
      expect(io.observers.every((o) => o.targets.length === 0)).toBe(true);
    });
  });
});
