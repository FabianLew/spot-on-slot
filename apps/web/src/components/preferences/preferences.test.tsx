import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@spot-on-slot/ui";
import messages from "../../../messages/pl.json";
import { LanguageMenu, LanguageRadioList } from "./language-menu";
import { ThemeMenu, ThemeRadioList } from "./theme-menu";

const setTheme = vi.fn();
const refresh = vi.fn();
const setLocale = vi.fn<(locale: string) => Promise<void>>();

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/i18n/actions", () => ({ setLocale: (l: string) => setLocale(l) }));

function renderInMenu(children: ReactNode) {
  return render(
    <NextIntlClientProvider locale="pl" messages={messages}>
      <DropdownMenu>
        <DropdownMenuTrigger>Otwórz</DropdownMenuTrigger>
        <DropdownMenuContent>{children}</DropdownMenuContent>
      </DropdownMenu>
    </NextIntlClientProvider>,
  );
}

async function open() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Otwórz" }));
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  setLocale.mockResolvedValue(undefined);
});

describe("ThemeMenu", () => {
  it("marks the current theme and sets the chosen one", async () => {
    renderInMenu(<ThemeMenu />);
    const user = await open();
    expect(await screen.findByText("Motyw")).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "Jasny" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemradio", { name: "Ciemny" })).toHaveAttribute("aria-checked", "false");
    await user.click(screen.getByRole("menuitemradio", { name: "Ciemny" }));
    expect(setTheme).toHaveBeenCalledWith("dark");
  });
});

describe("LanguageMenu", () => {
  it("marks the current locale, sets the cookie, then refreshes", async () => {
    renderInMenu(<LanguageMenu />);
    const user = await open();
    expect(await screen.findByText("Język")).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "Polski" })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("menuitemradio", { name: "English" }));
    expect(setLocale).toHaveBeenCalledWith("en");
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(setLocale.mock.invocationCallOrder[0]).toBeLessThan(refresh.mock.invocationCallOrder[0]!);
  });
});

describe("RadioList variants", () => {
  function renderPlain(ui: ReactNode) {
    return render(
      <NextIntlClientProvider locale="pl" messages={messages}>
        {ui}
      </NextIntlClientProvider>,
    );
  }

  it("ThemeRadioList sets the chosen theme", async () => {
    renderPlain(<ThemeRadioList />);
    await userEvent.setup().click(screen.getByRole("radio", { name: "Ciemny" }));
    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("LanguageRadioList sets the chosen locale, then refreshes", async () => {
    renderPlain(<LanguageRadioList />);
    await userEvent.setup().click(screen.getByRole("radio", { name: "English" }));
    expect(setLocale).toHaveBeenCalledWith("en");
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });
});
