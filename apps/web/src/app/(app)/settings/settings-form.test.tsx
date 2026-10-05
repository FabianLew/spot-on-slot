import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import pl from "../../../../messages/pl.json";
import { SettingsForm } from "./settings-form";
import { settingsSchema } from "./settings-schema";

const setTheme = vi.fn();
const refresh = vi.fn();
const setLocale = vi.fn<(locale: string) => Promise<void>>();
const toastSuccess = vi.fn();

vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "light", setTheme }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/i18n/actions", () => ({ setLocale: (l: string) => setLocale(l) }));
vi.mock("@spot-on-slot/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@spot-on-slot/ui")>()),
  toast: { success: (m: string) => toastSuccess(m) },
}));

function renderForm() {
  return render(
    <NextIntlClientProvider locale="pl" messages={pl}>
      <SettingsForm />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setLocale.mockResolvedValue(undefined);
});

describe("settingsSchema", () => {
  it("rejects an unsupported locale with a message key", () => {
    const result = settingsSchema.safeParse({ locale: "de", theme: "dark" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("validation.invalidOption");
  });

  it("accepts supported values", () => {
    expect(settingsSchema.safeParse({ locale: "en", theme: "dark" }).success).toBe(true);
  });
});

describe("SettingsForm", () => {
  it("shows the current locale and theme as defaults", () => {
    renderForm();
    expect(screen.getByRole("combobox", { name: "Język" })).toHaveTextContent("Polski");
    expect(screen.getByRole("combobox", { name: "Motyw" })).toHaveTextContent("Jasny");
  });

  it("saves locale and theme, refreshes and confirms", async () => {
    renderForm();
    const user = userEvent.setup();
    await user.click(screen.getByRole("combobox", { name: "Język" }));
    await user.click(await screen.findByRole("option", { name: "English" }));
    await user.click(screen.getByRole("combobox", { name: "Motyw" }));
    await user.click(await screen.findByRole("option", { name: "Ciemny" }));
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Zapisano"));
    expect(setLocale).toHaveBeenCalledWith("en");
    expect(setTheme).toHaveBeenCalledWith("dark");
    expect(refresh).toHaveBeenCalled();
  });

  it("does not set the locale when it is unchanged", async () => {
    renderForm();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(setLocale).not.toHaveBeenCalled();
    expect(setTheme).toHaveBeenCalledWith("light");
  });
});
