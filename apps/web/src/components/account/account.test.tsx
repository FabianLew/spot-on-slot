import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import pl from "../../../messages/pl.json";
import { LoginForm } from "@/components/auth/login-form";
import { AuthGate } from "@/components/session/auth-gate";
import { SessionProvider } from "@/components/session/session-provider";
import { AccountGate, TermsNotice } from "./account-gate";
import { deletionSchema, passwordSchema } from "./account-schemas";
import { AccountSettings } from "./account-settings";
import { ConfirmEmailChange } from "./confirm-email-change";
import { exportFileName } from "./export-data";

const replace = vi.fn();
let pathname = "/dashboard";
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }), usePathname: () => pathname }));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("@spot-on-slot/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@spot-on-slot/ui")>()),
  toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) },
}));

type Handler = (request: Request) => Response | Promise<Response>;
let routes: Record<string, Handler>;
let bodies: Record<string, unknown>;
let calls: string[];

const problem = (status: number, code: string, detail: string, errors?: { field: string; message: string }[]) =>
  Response.json({ type: "about:blank", title: "x", status, code, detail, requestId: "r1", errors }, { status });
const noContent = () => new Response(null, { status: 204 });

const me = (overrides: object = {}) => ({
  id: "u1",
  email: "dj@example.com",
  role: "ARTIST",
  locale: "pl",
  termsAccepted: true,
  termsVersion: "2026-10",
  deletionScheduledAt: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  pathname = "/dashboard";
  bodies = {};
  calls = [];
  routes = {
    "POST /api/v1/auth/refresh": () => Response.json({ accessToken: "t1", tokenType: "Bearer", expiresIn: 900 }),
    "POST /api/v1/auth/logout": noContent,
    "GET /api/v1/me": () => Response.json(me()),
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      const key = `${request.method} ${new URL(request.url).pathname}`;
      calls.push(key);
      const text = await request.clone().text();
      if (text) bodies[key] = JSON.parse(text);
      const handler = routes[key];
      return handler ? handler(request) : new Response(null, { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderUi(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="pl" messages={pl} timeZone="Europe/Warsaw">
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <SessionProvider>{ui}</SessionProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

const field = (name: string) => screen.getByLabelText(name, { exact: true });

async function fill(user: ReturnType<typeof userEvent.setup>, element: HTMLElement, text: string) {
  await user.click(element);
  await user.paste(text);
}

async function openDialog(user: ReturnType<typeof userEvent.setup>, button: string) {
  renderUi(<AccountSettings />);
  expect(await screen.findByText("dj@example.com")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: button }));
  return screen.findByRole("dialog");
}

describe("account schemas", () => {
  it("checks the new password and its repeat, and the deletion checkbox", () => {
    const valid = { currentPassword: "stare", newPassword: "nowe dlugie haslo", passwordRepeat: "nowe dlugie haslo" };
    expect(passwordSchema.safeParse(valid).success).toBe(true);
    expect(passwordSchema.safeParse({ ...valid, currentPassword: "" }).error?.issues[0]?.message).toBe("validation.required");
    expect(passwordSchema.safeParse({ ...valid, newPassword: "krotkie", passwordRepeat: "krotkie" }).error?.issues[0]?.message).toBe(
      "validation.passwordTooShort",
    );
    expect(passwordSchema.safeParse({ ...valid, passwordRepeat: "inne" }).error?.issues[0]?.message).toBe("validation.passwordMismatch");
    expect(deletionSchema.safeParse({ password: "x", confirm: false }).error?.issues[0]?.message).toBe("validation.confirmDeletion");
  });
});

describe("AccountSettings, password", () => {
  async function submitPassword(user: ReturnType<typeof userEvent.setup>) {
    const dialog = await openDialog(user, "Zmień hasło");
    await fill(user, field(pl.account.currentPassword), "stare haslo");
    await fill(user, field(pl.auth.fields.newPassword), "nowe dlugie haslo");
    await fill(user, field(pl.auth.fields.passwordRepeat), "nowe dlugie haslo");
    await user.click(within(dialog).getByRole("button", { name: "Zmień hasło" }));
    return dialog;
  }

  it("changes the password and confirms with a toast", async () => {
    routes["PUT /api/v1/me/password"] = noContent;
    const user = userEvent.setup();
    await submitPassword(user);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(pl.account.password.changed));
    expect(bodies["PUT /api/v1/me/password"]).toEqual({ currentPassword: "stare haslo", newPassword: "nowe dlugie haslo" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("puts a wrong password on the current password field", async () => {
    routes["PUT /api/v1/me/password"] = () =>
      problem(400, "IDENTITY_WRONG_PASSWORD", "Hasło jest nieprawidłowe.", [
        { field: "currentPassword", message: "Hasło jest nieprawidłowe." },
      ]);
    const user = userEvent.setup();
    await submitPassword(user);
    expect(await screen.findByText("Hasło jest nieprawidłowe.")).toBeInTheDocument();
    expect(field(pl.account.currentPassword)).toHaveAttribute("aria-invalid", "true");
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("asks to wait after too many attempts", async () => {
    routes["PUT /api/v1/me/password"] = () => problem(429, "ACCOUNT_TOO_MANY_ATTEMPTS", "Too many");
    const user = userEvent.setup();
    const dialog = await submitPassword(user);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(pl.account.tooManyAttempts);
  });
});

describe("AccountSettings, e-mail", () => {
  async function submitEmail(user: ReturnType<typeof userEvent.setup>) {
    const dialog = await openDialog(user, "Zmień e-mail");
    await fill(user, field(pl.account.email.newEmail), "nowy@example.com");
    await fill(user, field(pl.account.currentPassword), "stare haslo");
    await user.click(within(dialog).getByRole("button", { name: pl.account.email.submit }));
    return dialog;
  }

  it("sends the link and says where to look", async () => {
    routes["POST /api/v1/me/email-change"] = () => new Response(null, { status: 202 });
    const user = userEvent.setup();
    const dialog = await submitEmail(user);
    expect(await within(dialog).findByRole("status")).toHaveTextContent(
      "Sprawdź skrzynkę nowy@example.com, link jest ważny 24 h.",
    );
    expect(bodies["POST /api/v1/me/email-change"]).toEqual({ newEmail: "nowy@example.com", currentPassword: "stare haslo" });
  });

  it("puts a wrong password on its field", async () => {
    routes["POST /api/v1/me/email-change"] = () =>
      problem(400, "IDENTITY_WRONG_PASSWORD", "Hasło jest nieprawidłowe.", [
        { field: "currentPassword", message: "Hasło jest nieprawidłowe." },
      ]);
    const user = userEvent.setup();
    await submitEmail(user);
    await waitFor(() => expect(field(pl.account.currentPassword)).toHaveAttribute("aria-invalid", "true"));
  });

  it("asks to wait after too many attempts", async () => {
    routes["POST /api/v1/me/email-change"] = () => problem(429, "ACCOUNT_TOO_MANY_ATTEMPTS", "Too many");
    const user = userEvent.setup();
    const dialog = await submitEmail(user);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(pl.account.tooManyAttempts);
  });
});

describe("AccountSettings, data export", () => {
  it("names the file from the header, else by the date", () => {
    expect(exportFileName('attachment; filename="spot-on-slot-dane-2026-10-07.json"')).toBe("spot-on-slot-dane-2026-10-07.json");
    expect(exportFileName(null, new Date("2026-10-07T23:30:00Z"))).toBe("spot-on-slot-dane-2026-10-08.json");
  });

  it("downloads the file", async () => {
    routes["GET /api/v1/me/export"] = () =>
      new Response('{"konto":{}}', {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": 'attachment; filename="spot-on-slot-dane-2026-10-07.json"',
        },
      });
    // jsdom has no object URLs.
    const createObjectURL = vi.fn((blob: Blob) => (blob.size > 0 ? "blob:export" : "blob:empty"));
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(`${this.download} ${this.href}`);
    });
    const user = userEvent.setup();
    renderUi(<AccountSettings />);
    await user.click(await screen.findByRole("button", { name: pl.account.export.download }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(pl.account.export.done));
    expect(downloads).toEqual(["spot-on-slot-dane-2026-10-07.json blob:export"]);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it("shows the backend's text when asked too often", async () => {
    routes["GET /api/v1/me/export"] = () => problem(429, "ACCOUNT_EXPORT_TOO_SOON", "Spróbuj za minutę.");
    const user = userEvent.setup();
    renderUi(<AccountSettings />);
    await user.click(await screen.findByRole("button", { name: pl.account.export.download }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Spróbuj za minutę."));
  });
});

describe("AccountSettings, deletion", () => {
  it("sends the last owner of a shared venue to the team first", async () => {
    routes["GET /api/v1/me/deletion"] = () =>
      Response.json({ blockers: [{ kind: "LAST_VENUE_OWNER", id: "v1", name: "Klub X" }], graceDays: 14 });
    const user = userEvent.setup();
    const dialog = await openDialog(user, "Usuń konto");
    expect(await within(dialog).findByRole("link", { name: "Zespół lokalu Klub X" })).toHaveAttribute(
      "href",
      "/profile/venues/v1/team",
    );
    expect(within(dialog).queryByRole("button", { name: "Usuń konto" })).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(pl.account.currentPassword)).not.toBeInTheDocument();
  });

  it("explains what happens, needs the checkbox, deletes and signs out to the login page", async () => {
    routes["GET /api/v1/me/deletion"] = () => Response.json({ blockers: [], graceDays: 14 });
    routes["POST /api/v1/me/deletion"] = () => Response.json({ deletionScheduledAt: "2026-10-21T10:00:00Z" }, { status: 202 });
    const user = userEvent.setup();
    renderUi(
      <AuthGate>
        <AccountSettings />
      </AuthGate>,
    );
    await user.click(await screen.findByRole("button", { name: "Usuń konto" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText(/Przez 14 dni możesz przywrócić konto/)).toBeInTheDocument();
    await fill(user, within(dialog).getByLabelText(pl.account.currentPassword), "moje haslo");
    await user.click(within(dialog).getByRole("button", { name: "Usuń konto" }));
    expect(await within(dialog).findByText(pl.validation.confirmDeletion)).toBeInTheDocument();
    expect(calls).not.toContain("POST /api/v1/me/deletion");

    await user.click(within(dialog).getByRole("checkbox", { name: "Rozumiem" }));
    await user.click(within(dialog).getByRole("button", { name: "Usuń konto" }));
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(`/login?deleted=${encodeURIComponent("2026-10-21T10:00:00Z")}`),
    );
    expect(bodies["POST /api/v1/me/deletion"]).toEqual({ password: "moje haslo", confirm: true });
    expect(calls).toContain("POST /api/v1/auth/logout");
  });

  it("tells the login page when the account will be deleted", async () => {
    routes["POST /api/v1/auth/refresh"] = () => problem(401, "IDENTITY_REFRESH_INVALID", "x");
    renderUi(<LoginForm deletedAt="2026-10-21T10:00:00Z" />);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Konto zostanie usunięte 21 października 2026. Zaloguj się przed tym dniem, jeśli chcesz je przywrócić.",
    );
  });

  it("puts a wrong password on its field", async () => {
    routes["GET /api/v1/me/deletion"] = () => Response.json({ blockers: [], graceDays: 14 });
    routes["POST /api/v1/me/deletion"] = () =>
      problem(400, "IDENTITY_WRONG_PASSWORD", "Hasło jest nieprawidłowe.", [
        { field: "password", message: "Hasło jest nieprawidłowe." },
      ]);
    const user = userEvent.setup();
    const dialog = await openDialog(user, "Usuń konto");
    await fill(user, await within(dialog).findByLabelText(pl.account.currentPassword), "zle");
    await user.click(within(dialog).getByRole("checkbox", { name: "Rozumiem" }));
    await user.click(within(dialog).getByRole("button", { name: "Usuń konto" }));
    expect(await within(dialog).findByText("Hasło jest nieprawidłowe.")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("AccountGate", () => {
  const app = (
    <AccountGate>
      <p>Aplikacja</p>
    </AccountGate>
  );

  it("shows only the restore screen while deletion is pending, then restores the account", async () => {
    let pending = true;
    routes["GET /api/v1/me"] = () => Response.json(me({ deletionScheduledAt: pending ? "2026-10-21T10:00:00Z" : null }));
    routes["POST /api/v1/me/deletion/cancel"] = () => {
      pending = false;
      return noContent();
    };
    const user = userEvent.setup();
    renderUi(app);
    expect(
      await screen.findByRole("heading", { name: "Twoje konto zostanie usunięte 21 października 2026" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Aplikacja")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Przywróć konto" }));
    expect(await screen.findByText("Aplikacja")).toBeInTheDocument();
    expect(calls).toContain("POST /api/v1/me/deletion/cancel");
    expect(toastSuccess).toHaveBeenCalledWith(pl.account.pending.restored);
  });

  it("signs out from the restore screen", async () => {
    routes["GET /api/v1/me"] = () => Response.json(me({ deletionScheduledAt: "2026-10-21T10:00:00Z" }));
    const user = userEvent.setup();
    renderUi(app);
    await user.click(await screen.findByRole("button", { name: "Wyloguj" }));
    await waitFor(() => expect(calls).toContain("POST /api/v1/auth/logout"));
    expect(calls).not.toContain("POST /api/v1/me/deletion/cancel");
  });

  it("blocks the app with the terms dialog until they are accepted", async () => {
    let accepted = false;
    routes["GET /api/v1/me"] = () => Response.json(me({ termsAccepted: accepted }));
    routes["POST /api/v1/me/terms"] = () => {
      accepted = true;
      return noContent();
    };
    const user = userEvent.setup();
    renderUi(app);
    const dialog = await screen.findByRole("dialog", { name: pl.account.terms.title });
    expect(within(dialog).getByRole("link", { name: "regulamin" })).toHaveAttribute("href", "http://localhost:3001/pl/regulamin");
    expect(within(dialog).getByRole("link", { name: "politykę prywatności" })).toHaveAttribute(
      "href",
      "http://localhost:3001/pl/polityka-prywatnosci",
    );
    expect(within(dialog).getByRole("link", { name: "Ustawienia" })).toHaveAttribute("href", "/settings");
    await user.click(within(dialog).getByRole("button", { name: "Akceptuję" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls).toContain("POST /api/v1/me/terms");
  });

  it("leaves Settings usable, where the page shows the terms notice instead of the dialog", async () => {
    pathname = "/settings";
    let accepted = false;
    routes["GET /api/v1/me"] = () => Response.json(me({ termsAccepted: accepted }));
    routes["POST /api/v1/me/terms"] = () => {
      accepted = true;
      return noContent();
    };
    const user = userEvent.setup();
    renderUi(
      <AccountGate>
        <TermsNotice />
        <p>Aplikacja</p>
      </AccountGate>,
    );
    const notice = await screen.findByRole("region", { name: pl.account.terms.title });
    expect(screen.getByText("Aplikacja")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(within(notice).getByRole("button", { name: "Akceptuję" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: pl.account.terms.title })).not.toBeInTheDocument());
    expect(calls).toContain("POST /api/v1/me/terms");
  });
});

describe("ConfirmEmailChange", () => {
  it("confirms the token and sends a signed-out visitor to the login", async () => {
    routes["POST /api/v1/auth/refresh"] = () => problem(401, "IDENTITY_REFRESH_INVALID", "x");
    routes["POST /api/v1/auth/email-change/confirm"] = noContent;
    renderUi(<ConfirmEmailChange token="abc" />);
    expect(await screen.findByText(pl.account.confirmEmail.success)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zaloguj się" })).toHaveAttribute("href", "/login");
    expect(bodies["POST /api/v1/auth/email-change/confirm"]).toEqual({ token: "abc" });
  });

  it("links a signed-in user to the settings and reloads the account", async () => {
    routes["POST /api/v1/auth/email-change/confirm"] = noContent;
    renderUi(<ConfirmEmailChange token="abc" />);
    expect(await screen.findByRole("link", { name: pl.account.confirmEmail.toSettings })).toHaveAttribute("href", "/settings");
    expect(screen.getByText(pl.account.confirmEmail.successSignedIn)).toBeInTheDocument();
    await waitFor(() => expect(calls.filter((c) => c === "GET /api/v1/me")).toHaveLength(2));
  });

  it("explains an invalid link", async () => {
    routes["POST /api/v1/auth/email-change/confirm"] = () => problem(400, "IDENTITY_TOKEN_INVALID", "x");
    renderUi(<ConfirmEmailChange token="abc" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(pl.account.confirmEmail.invalid);
  });

  it("explains a taken address", async () => {
    routes["POST /api/v1/auth/email-change/confirm"] = () => problem(409, "IDENTITY_EMAIL_TAKEN", "x");
    renderUi(<ConfirmEmailChange token="abc" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(pl.account.confirmEmail.taken);
  });

  it("treats a missing token as invalid without calling the backend", async () => {
    renderUi(<ConfirmEmailChange />);
    expect(await screen.findByRole("alert")).toHaveTextContent(pl.account.confirmEmail.invalid);
    expect(calls).not.toContain("POST /api/v1/auth/email-change/confirm");
  });
});
