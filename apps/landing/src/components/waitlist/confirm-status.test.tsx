import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import pl from "../../../messages/pl.json";
import { ConfirmStatus } from "./confirm-status";

// openapi-fetch captures `globalThis.fetch` when `api` is created at import time, so stub it first.
const { fetchMock } = vi.hoisted(() => {
  const fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock };
});

beforeEach(() => {
  document.documentElement.lang = "pl";
});

afterEach(() => {
  fetchMock.mockReset();
  document.documentElement.lang = "";
});

afterAll(() => vi.unstubAllGlobals());

function renderStatus(token: string | null) {
  render(
    <NextIntlClientProvider locale="pl" messages={pl}>
      <ConfirmStatus token={token} />
    </NextIntlClientProvider>,
  );
}

function problem(status: number, code: string) {
  return new Response(JSON.stringify({ status, code, title: code }), {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });
}

function ok() {
  return new Response(JSON.stringify({ status: "CONFIRMED" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function postedBody() {
  const [input] = fetchMock.mock.calls[0];
  return (input as Request).clone().json();
}

describe("ConfirmStatus", () => {
  it("shows a busy status while the request is pending", () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderStatus("abc");
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent(pl.confirm.loading);
  });

  it("confirms the sign-up and posts the token once", async () => {
    fetchMock.mockResolvedValue(ok());
    renderStatus("abc");

    expect(await screen.findByText(pl.confirm.success.title)).toBeInTheDocument();
    expect(screen.getByText(pl.confirm.success.text)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: pl.confirm.backHome })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await postedBody()).toEqual({ token: "abc" });
  });

  it("shows the expired state with a link to the waitlist form", async () => {
    fetchMock.mockResolvedValue(problem(422, "WAITLIST_TOKEN_EXPIRED"));
    renderStatus("abc");

    expect(await screen.findByText(pl.confirm.expired.title)).toBeInTheDocument();
    expect(screen.getByText(pl.confirm.expired.text)).toBeInTheDocument();
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toMatch(/#waitlist$/);
  });

  it("shows the invalid state for an unknown token", async () => {
    fetchMock.mockResolvedValue(problem(404, "WAITLIST_TOKEN_INVALID"));
    renderStatus("nope");

    expect(await screen.findByText(pl.confirm.invalid.title)).toBeInTheDocument();
    expect(screen.getByText(pl.confirm.invalid.text)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: pl.confirm.backHome })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: pl.confirm.retry })).not.toBeInTheDocument();
  });

  it("offers a retry on a network error that can reach the confirmed state", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    renderStatus("abc");

    expect(await screen.findByText(pl.confirm.invalid.title)).toBeInTheDocument();
    const retry = screen.getByRole("button", { name: pl.confirm.retry });

    fetchMock.mockResolvedValue(ok());
    await userEvent.setup().click(retry);

    expect(await screen.findByText(pl.confirm.success.title)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["a 500 problem", () => problem(500, "INTERNAL_ERROR")],
    ["a 503 problem", () => problem(503, "INTERNAL_ERROR")],
    ["a 502 HTML page", () => new Response("<html>Bad Gateway</html>", { status: 502, headers: { "Content-Type": "text/html" } })],
  ])("treats %s as a network error with a retry", async (_label, response) => {
    fetchMock.mockResolvedValueOnce(response());
    renderStatus("abc");

    const retry = await screen.findByRole("button", { name: pl.confirm.retry });
    expect(screen.getByText(pl.confirm.invalid.title)).toBeInTheDocument();

    fetchMock.mockResolvedValue(ok());
    await userEvent.setup().click(retry);
    expect(await screen.findByText(pl.confirm.success.title)).toBeInTheDocument();
  });

  it("is invalid without a request when there is no token", async () => {
    renderStatus(null);

    expect(await screen.findByText(pl.confirm.invalid.title)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
