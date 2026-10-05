import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/pl.json";
import { BottomTabs } from "./bottom-tabs";
import { Sidebar } from "./sidebar";

let pathname = "/calendar";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "light", setTheme: vi.fn() }) }));
vi.mock("@/i18n/actions", () => ({ setLocale: vi.fn() }));
const signOut = vi.fn();
vi.mock("@/components/session/session-provider", () => ({
  useSession: () => ({
    session: { status: "authenticated", user: { id: "1", email: "dj@example.com", role: "ARTIST", locale: "pl" } },
    signOut,
  }),
}));

function renderIntl(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="pl" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  pathname = "/calendar";
  signOut.mockClear();
});

describe("Sidebar", () => {
  it("renders all sections and marks the current one", () => {
    renderIntl(<Sidebar />);
    const nav = screen.getByRole("navigation", { name: "Nawigacja główna" });
    expect(within(nav).getAllByRole("link")).toHaveLength(8);
    expect(within(nav).getByRole("link", { name: "Kalendarz" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Pulpit" })).not.toHaveAttribute("aria-current");
  });

  it("shows the signed-in e-mail and signs out from the user menu", async () => {
    renderIntl(<Sidebar />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Menu" }));
    expect(await screen.findByText("dj@example.com")).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: messages.auth.logout }));
    expect(signOut).toHaveBeenCalled();
  });
});

describe("BottomTabs", () => {
  it("renders 4 tabs and a More button that opens the remaining sections and preferences", async () => {
    renderIntl(<BottomTabs />);
    const nav = screen.getByRole("navigation", { name: "Nawigacja główna" });
    expect(within(nav).getAllByRole("link")).toHaveLength(4);
    await userEvent.setup().click(within(nav).getByRole("button", { name: "Więcej" }));
    const dialog = await screen.findByRole("dialog");
    for (const name of ["Ogłoszenia", "Bookingi", "Profil", "Ustawienia"]) {
      expect(within(dialog).getByRole("link", { name })).toBeInTheDocument();
    }
    expect(within(dialog).getByRole("radio", { name: "Polski" })).toBeChecked();
    expect(within(dialog).getByRole("radio", { name: "Jasny" })).toBeChecked();
    await userEvent.setup().click(within(dialog).getByRole("button", { name: messages.auth.logout }));
    expect(signOut).toHaveBeenCalled();
  });
});

describe("MoreSheet trigger", () => {
  it("looks active (indicator, no aria-current) on a section inside the sheet", () => {
    pathname = "/profile";
    renderIntl(<BottomTabs />);
    const trigger = screen.getByRole("button", { name: "Więcej" });
    expect(trigger.querySelector("[data-active-indicator]")).not.toBeNull();
    expect(trigger).toHaveClass("text-foreground");
    expect(trigger).not.toHaveAttribute("aria-current");
  });

  it("is not active on a tab section", () => {
    pathname = "/calendar";
    renderIntl(<BottomTabs />);
    const trigger = screen.getByRole("button", { name: "Więcej" });
    expect(trigger.querySelector("[data-active-indicator]")).toBeNull();
    expect(trigger).toHaveClass("text-muted-foreground");
  });
});

describe("MoreSheet", () => {
  it("marks the active section with aria-current and an indicator", async () => {
    pathname = "/profile";
    renderIntl(<BottomTabs />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Więcej" }));
    const link = within(await screen.findByRole("dialog")).getByRole("link", { name: "Profil" });
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link.querySelector("[data-active-indicator]")).not.toBeNull();
  });
});
