import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import pl from "../../../messages/pl.json";
import { WaitlistForm } from "./waitlist-form";

// openapi-fetch captures `globalThis.fetch` when `api` is created at import time, so stub it first.
const { fetchMock } = vi.hoisted(() => {
  const fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock };
});

beforeEach(() => {
  // The layout sets <html lang>; `api` sends it as Accept-Language.
  document.documentElement.lang = "pl";
});

afterEach(() => {
  fetchMock.mockReset();
  document.documentElement.lang = "";
});

afterAll(() => vi.unstubAllGlobals());

afterEach(() => {
  delete (globalThis as { umami?: unknown }).umami;
});

function renderForm() {
  const user = userEvent.setup();
  render(
    <NextIntlClientProvider locale="pl" messages={pl}>
      <WaitlistForm />
    </NextIntlClientProvider>,
  );
  return user;
}

async function fillValid(user: ReturnType<typeof userEvent.setup>, email = "ola@example.com") {
  await user.type(screen.getByLabelText(pl.waitlist.emailLabel), email);
  await user.click(screen.getByRole("combobox", { name: pl.waitlist.roleLabel }));
  await user.click(await screen.findByRole("option", { name: pl.waitlist.roles.ARTIST }));
  await user.type(screen.getByLabelText(pl.waitlist.cityLabel), "Kraków");
  await user.click(screen.getByRole("checkbox", { name: pl.waitlist.consentLabel }));
}

function submit(user: ReturnType<typeof userEvent.setup>) {
  return user.click(screen.getByRole("button", { name: pl.waitlist.submit }));
}

function sentRequest(): Request {
  const [input] = fetchMock.mock.calls[0];
  return input as Request;
}

function successText(email: string) {
  return pl.waitlist.successText.replace("{email}", email);
}

describe("WaitlistForm", () => {
  it("shows the four validation messages on an empty submit and does not call the API", async () => {
    const user = renderForm();
    await submit(user);

    expect(await screen.findByText(pl.validation.emailInvalid)).toBeInTheDocument();
    expect(screen.getByText(pl.validation.roleRequired)).toBeInTheDocument();
    expect(screen.getByText(pl.validation.cityRequired)).toBeInTheDocument();
    expect(screen.getByText(pl.validation.consentRequired)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the sign-up with the page locale and shows the success block", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));
    const user = renderForm();
    await fillValid(user);
    await submit(user);

    expect(await screen.findByText(pl.waitlist.successTitle)).toBeInTheDocument();
    expect(screen.getByText(successText("ola@example.com"))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: pl.waitlist.submit })).not.toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = sentRequest();
    expect(request.method).toBe("POST");
    expect(request.url).toMatch(/\/api\/v1\/waitlist\/signups$/);
    expect(request.headers.get("Accept-Language")).toBe("pl");
    expect(await request.json()).toEqual({
      email: "ola@example.com",
      role: "ARTIST",
      city: "Kraków",
      consent: true,
      website: "",
      locale: "pl",
    });
  });

  it("shows field errors from a validation problem under the field", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "about:blank",
          title: "Nieprawidłowe dane",
          status: 400,
          code: "VALIDATION_FAILED",
          requestId: "r1",
          errors: [{ field: "city", code: "Size", message: "za krótkie" }],
        }),
        { status: 400, headers: { "Content-Type": "application/problem+json" } },
      ),
    );
    const user = renderForm();
    await fillValid(user);
    await submit(user);

    const message = await screen.findByText("za krótkie");
    const cityItem = screen.getByLabelText(pl.waitlist.cityLabel).closest('[data-slot="form-item"]') as HTMLElement;
    expect(within(cityItem).getByText("za krótkie")).toBe(message);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(pl.waitlist.successTitle)).not.toBeInTheDocument();
  });

  it("shows the fallback error with an icon and keeps the form when the request fails", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const user = renderForm();
    await fillValid(user);
    await submit(user);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(pl.waitlist.error);
    expect(alert.querySelector("svg")).not.toBeNull();
    expect(screen.getByLabelText(pl.waitlist.emailLabel)).toHaveValue("ola@example.com");
    await waitFor(() => expect(screen.getByRole("button", { name: pl.waitlist.submit })).toBeEnabled());
  });

  it("sends a filled honeypot as-is and shows success", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));
    const user = renderForm();
    await fillValid(user, "bot@example.com");
    const honeypot = document.querySelector('input[name="website"]') as HTMLInputElement;
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot).toHaveAttribute("aria-hidden", "true");
    await user.type(honeypot, "spam");
    await submit(user);

    expect(await screen.findByText(successText("bot@example.com"))).toBeInTheDocument();
    expect(await sentRequest().json()).toMatchObject({ website: "spam" });
  });
});

describe("WaitlistForm analytics", () => {
  it("reports a sign-up with the role only, never the e-mail", async () => {
    const track = vi.fn();
    (globalThis as { umami?: unknown }).umami = { track };
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));
    const user = renderForm();
    await fillValid(user);
    await submit(user);
    await screen.findByRole("status");
    expect(track).toHaveBeenCalledWith("waitlist-signup", { role: "ARTIST" });
  });

  it("does not report a failed sign-up", async () => {
    const track = vi.fn();
    (globalThis as { umami?: unknown }).umami = { track };
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const user = renderForm();
    await fillValid(user);
    await submit(user);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(track).not.toHaveBeenCalled();
  });
});
