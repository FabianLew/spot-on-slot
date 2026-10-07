import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import pl from "../../../messages/pl.json";
import { SessionProvider } from "@/components/session/session-provider";
import { registerSchema } from "./auth-schemas";
import { ForgotPasswordForm } from "./forgot-password-form";
import { LoginForm } from "./login-form";
import { RegisterForm } from "./register-form";
import { ResetPasswordForm } from "./reset-password-form";
import { VerifyEmail } from "./verify-email";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

type Handler = (request: Request) => Response | Promise<Response>;
let routes: Record<string, Handler>;
let bodies: Record<string, unknown>;

const problem = (status: number, code: string, detail: string) =>
  Response.json({ type: "about:blank", title: "x", status, code, detail, requestId: "r1" }, { status });
const accepted = () => new Response(null, { status: 202 });
const noContent = () => new Response(null, { status: 204 });

beforeEach(() => {
  vi.clearAllMocks();
  bodies = {};
  routes = {
    "POST /api/v1/auth/refresh": () => problem(401, "IDENTITY_REFRESH_INVALID", "Zaloguj się ponownie."),
    "GET /api/v1/me": () => Response.json({ id: "1", email: "dj@example.com", role: "ARTIST", locale: "pl" }),
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      const key = `${request.method} ${new URL(request.url).pathname}`;
      const text = await request.clone().text();
      if (text) bodies[key] = JSON.parse(text);
      const handler = routes[key];
      return handler ? handler(request) : new Response(null, { status: 404 });
    }),
  );
});

function renderWithSession(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="pl" messages={pl}>
      <QueryClientProvider client={new QueryClient()}>
        <SessionProvider>{ui}</SessionProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

const field = (name: string) => screen.getByLabelText(name, { exact: true });
const termsName = "Akceptuję regulamin i politykę prywatności";

async function fillRegistration(user: ReturnType<typeof userEvent.setup>, email: string) {
  await user.type(field(pl.auth.fields.email), email);
  await user.type(field(pl.auth.fields.password), "bardzo dlugie haslo");
  await user.type(field(pl.auth.fields.passwordRepeat), "bardzo dlugie haslo");
  await user.click(screen.getByRole("checkbox", { name: pl.auth.register.privacyAccept }));
}

describe("registerSchema", () => {
  const valid = { email: "dj@example.com", password: "dlugie haslo", passwordRepeat: "dlugie haslo", acceptTerms: true, privacyNoticeAccepted: true };
  const messageFor = (values: object) => registerSchema.safeParse({ ...valid, ...values }).error?.issues[0]?.message;

  it("accepts valid values", () => expect(registerSchema.safeParse(valid).success).toBe(true));
  it("checks e-mail, length, repeat, e-mail as password, the terms and the privacy notice", () => {
    expect(messageFor({ email: "nope" })).toBe("validation.email");
    expect(messageFor({ password: "short", passwordRepeat: "short" })).toBe("validation.passwordTooShort");
    expect(messageFor({ passwordRepeat: "inne haslo!" })).toBe("validation.passwordMismatch");
    expect(messageFor({ password: "DJ@example.com", passwordRepeat: "DJ@example.com" })).toBe("validation.passwordEqualsEmail");
    expect(messageFor({ acceptTerms: false })).toBe("validation.acceptTerms");
    expect(messageFor({ privacyNoticeAccepted: false })).toBe("validation.privacyRequired");
  });
});

describe("RegisterForm", () => {
  it("shows translated validation errors", async () => {
    renderWithSession(<RegisterForm role="ARTIST" />);
    await userEvent.click(screen.getByRole("button", { name: pl.auth.register.submit }));
    expect(await screen.findByText(pl.validation.required)).toBeInTheDocument();
    expect(screen.getByText(pl.validation.passwordTooShort)).toBeInTheDocument();
    expect(screen.getByText(pl.validation.privacyRequired)).toBeInTheDocument();
    expect(screen.getByText(pl.validation.acceptTerms)).toBeInTheDocument();
  });

  it("requires accepting the terms before calling the server", async () => {
    routes["POST /api/v1/auth/register"] = accepted;
    renderWithSession(<RegisterForm role="ARTIST" />);
    const user = userEvent.setup();
    await fillRegistration(user, "dj@example.com");
    await user.click(screen.getByRole("button", { name: pl.auth.register.submit }));
    expect(await screen.findByText(pl.validation.acceptTerms)).toBeInTheDocument();
    expect(bodies["POST /api/v1/auth/register"]).toBeUndefined();
  });

  it("links the terms and the privacy policy on the landing in a new tab", () => {
    renderWithSession(<RegisterForm role="ARTIST" />);
    const terms = screen.getByRole("link", { name: "regulamin" });
    const policy = screen.getByRole("link", { name: "politykę prywatności" });
    expect(terms).toHaveAttribute("href", "http://localhost:3001/pl/regulamin");
    expect(policy).toHaveAttribute("href", "http://localhost:3001/pl/polityka-prywatnosci");
    for (const link of [terms, policy]) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("maps a server error for the terms to the checkbox", async () => {
    routes["POST /api/v1/auth/register"] = () =>
      Response.json(
        { type: "about:blank", title: "Błąd", status: 400, code: "VALIDATION_FAILED", requestId: "r", errors: [{ field: "acceptTerms", message: "Musisz zaakceptować regulamin" }] },
        { status: 400 },
      );
    renderWithSession(<RegisterForm role="ARTIST" />);
    const user = userEvent.setup();
    await fillRegistration(user, "dj@example.com");
    await user.click(screen.getByRole("checkbox", { name: termsName }));
    await user.click(screen.getByRole("button", { name: pl.auth.register.submit }));
    expect(await screen.findByText("Musisz zaakceptować regulamin")).toBeInTheDocument();
  });

  it("registers with the chosen role and locale, then asks to check the inbox", async () => {
    routes["POST /api/v1/auth/register"] = accepted;
    routes["POST /api/v1/auth/verify-email/resend"] = accepted;
    renderWithSession(<RegisterForm role="VENUE" />);
    const user = userEvent.setup();
    await fillRegistration(user, "klub@example.com");
    await user.click(screen.getByRole("checkbox", { name: termsName }));
    await user.click(screen.getByRole("button", { name: pl.auth.register.submit }));
    expect(await screen.findByRole("heading", { name: pl.auth.checkEmail.title })).toBeInTheDocument();
    expect(bodies["POST /api/v1/auth/register"]).toEqual({
      email: "klub@example.com",
      password: "bardzo dlugie haslo",
      role: "VENUE",
      locale: "pl",
      privacyNoticeAccepted: true,
      acceptTerms: true,
    });
    await user.click(screen.getByRole("button", { name: pl.auth.checkEmail.resend }));
    expect(await screen.findByRole("status")).toHaveTextContent(pl.auth.checkEmail.resent);
    expect(bodies["POST /api/v1/auth/verify-email/resend"]).toEqual({ email: "klub@example.com" });
  });

  it("pins backend field errors to the field", async () => {
    routes["POST /api/v1/auth/register"] = () =>
      Response.json(
        { type: "about:blank", title: "Błąd", status: 400, code: "VALIDATION_FAILED", requestId: "r", errors: [{ field: "email", message: "Zły adres z serwera" }] },
        { status: 400 },
      );
    renderWithSession(<RegisterForm role="ARTIST" />);
    const user = userEvent.setup();
    await fillRegistration(user, "dj@example.com");
    await user.click(screen.getByRole("checkbox", { name: termsName }));
    await user.click(screen.getByRole("button", { name: pl.auth.register.submit }));
    expect(await screen.findByText("Zły adres z serwera")).toBeInTheDocument();
  });
});

describe("LoginForm", () => {
  async function submit(email = "dj@example.com", password = "bardzo dlugie haslo") {
    const user = userEvent.setup();
    await user.type(field(pl.auth.fields.email), email);
    await user.type(field(pl.auth.fields.password), password);
    await user.click(screen.getByRole("button", { name: pl.auth.login.submit }));
    return user;
  }

  it("signs in and returns to the requested page", async () => {
    routes["POST /api/v1/auth/login"] = () => Response.json({ accessToken: "t", tokenType: "Bearer", expiresIn: 900 });
    renderWithSession(<LoginForm next="/calendar" />);
    await submit();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/calendar"));
  });

  it("ignores a next parameter pointing to another site", async () => {
    routes["POST /api/v1/auth/login"] = () => Response.json({ accessToken: "t", tokenType: "Bearer", expiresIn: 900 });
    renderWithSession(<LoginForm next="//evil.example" />);
    await submit();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("shows the backend message for wrong credentials", async () => {
    routes["POST /api/v1/auth/login"] = () => problem(401, "IDENTITY_INVALID_CREDENTIALS", "Nieprawidłowy e-mail lub hasło.");
    renderWithSession(<LoginForm />);
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Nieprawidłowy e-mail lub hasło.");
    expect(replace).not.toHaveBeenCalled();
  });

  it("offers a new activation link for an unconfirmed account", async () => {
    routes["POST /api/v1/auth/login"] = () => problem(403, "IDENTITY_EMAIL_NOT_VERIFIED", "Potwierdź adres e-mail.");
    routes["POST /api/v1/auth/verify-email/resend"] = accepted;
    renderWithSession(<LoginForm />);
    const user = await submit();
    await user.click(await screen.findByRole("button", { name: pl.auth.login.resend }));
    expect(await screen.findByRole("status")).toHaveTextContent(pl.auth.login.resent);
    expect(bodies["POST /api/v1/auth/verify-email/resend"]).toEqual({ email: "dj@example.com" });
  });

  it("shows a connection message when the server is unreachable", async () => {
    routes["POST /api/v1/auth/login"] = () => Promise.reject(new TypeError("Failed to fetch"));
    renderWithSession(<LoginForm />);
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(pl.errors.NETWORK_ERROR);
  });
});

describe("VerifyEmail", () => {
  it("confirms the token once and offers to sign in", async () => {
    let calls = 0;
    routes["POST /api/v1/auth/verify-email"] = () => {
      calls += 1;
      return noContent();
    };
    renderWithSession(<VerifyEmail token="abc" />);
    expect(await screen.findByText(pl.auth.verify.success)).toBeInTheDocument();
    expect(bodies["POST /api/v1/auth/verify-email"]).toEqual({ token: "abc" });
    expect(calls).toBe(1);
  });

  it("asks for the e-mail and resends when the link is invalid", async () => {
    routes["POST /api/v1/auth/verify-email"] = () => problem(400, "IDENTITY_TOKEN_INVALID", "Link wygasł.");
    routes["POST /api/v1/auth/verify-email/resend"] = accepted;
    renderWithSession(<VerifyEmail token="old" />);
    expect(await screen.findByText(pl.auth.verify.invalid)).toBeInTheDocument();
    const user = userEvent.setup();
    await user.type(field(pl.auth.fields.email), "dj@example.com");
    await user.click(screen.getByRole("button", { name: pl.auth.verify.resend }));
    expect(await screen.findByRole("heading", { name: pl.auth.checkEmail.title })).toBeInTheDocument();
  });
});

describe("ForgotPasswordForm", () => {
  it("requests a reset link and confirms without revealing the account", async () => {
    routes["POST /api/v1/auth/password-reset"] = accepted;
    renderWithSession(<ForgotPasswordForm />);
    const user = userEvent.setup();
    await user.type(field(pl.auth.fields.email), "dj@example.com");
    await user.click(screen.getByRole("button", { name: pl.auth.forgot.submit }));
    expect(await screen.findByRole("status")).toHaveTextContent("dj@example.com");
    expect(bodies["POST /api/v1/auth/password-reset"]).toEqual({ email: "dj@example.com" });
  });
});

describe("ResetPasswordForm", () => {
  async function fill(password = "nowe dlugie haslo", repeat = password) {
    const user = userEvent.setup();
    await user.type(field(pl.auth.fields.newPassword), password);
    await user.type(field(pl.auth.fields.passwordRepeat), repeat);
    await user.click(screen.getByRole("button", { name: pl.auth.reset.submit }));
  }

  it("sets the new password with the token", async () => {
    routes["POST /api/v1/auth/password-reset/confirm"] = noContent;
    renderWithSession(<ResetPasswordForm token="tok" />);
    await fill();
    expect(await screen.findByText(pl.auth.reset.done)).toBeInTheDocument();
    expect(bodies["POST /api/v1/auth/password-reset/confirm"]).toEqual({ token: "tok", password: "nowe dlugie haslo" });
  });

  it("rejects different passwords before calling the server", async () => {
    renderWithSession(<ResetPasswordForm token="tok" />);
    await fill("nowe dlugie haslo", "inne dlugie haslo");
    expect(await screen.findByText(pl.validation.passwordMismatch)).toBeInTheDocument();
    expect(bodies["POST /api/v1/auth/password-reset/confirm"]).toBeUndefined();
  });

  it("shows the backend message for an expired link", async () => {
    routes["POST /api/v1/auth/password-reset/confirm"] = () => problem(400, "IDENTITY_TOKEN_INVALID", "Link wygasł.");
    renderWithSession(<ResetPasswordForm token="tok" />);
    await fill();
    expect(await screen.findByRole("alert")).toHaveTextContent("Link wygasł.");
  });

  it("explains a link without a token", () => {
    renderWithSession(<ResetPasswordForm />);
    expect(screen.getByText(pl.auth.reset.missingToken)).toBeInTheDocument();
  });
});
