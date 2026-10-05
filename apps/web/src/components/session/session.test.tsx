import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import pl from "../../../messages/pl.json";
import { AuthGate, safeNext } from "./auth-gate";
import { SessionProvider, useSession } from "./session-provider";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const user = { id: "0190", email: "dj@example.com", role: "ARTIST", locale: "pl" };

type Handler = (request: Request) => Response | Promise<Response>;
let routes: Record<string, Handler>;
const calls: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  routes = {
    "POST /api/v1/auth/refresh": () => Response.json({ accessToken: "t1", tokenType: "Bearer", expiresIn: 900 }),
    "GET /api/v1/me": (request) =>
      request.headers.get("Authorization") === "Bearer t1" ? Response.json(user) : new Response(null, { status: 401 }),
    "POST /api/v1/auth/logout": () => new Response(null, { status: 204 }),
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      const key = `${request.method} ${new URL(request.url).pathname}`;
      calls.push(key);
      const handler = routes[key];
      return handler ? handler(request) : new Response(null, { status: 404 });
    }),
  );
});

function SignOutButton() {
  const { signOut } = useSession();
  return <button onClick={() => void signOut()}>out</button>;
}

function renderGate() {
  return render(
    <NextIntlClientProvider locale="pl" messages={pl}>
      <QueryClientProvider client={new QueryClient()}>
        <SessionProvider>
          <AuthGate>
            <p>secret page</p>
            <SignOutButton />
          </AuthGate>
        </SessionProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe("AuthGate", () => {
  it("restores the session from the refresh cookie and shows the page", async () => {
    renderGate();
    expect(screen.getByRole("status")).toHaveTextContent(pl.auth.loading);
    expect(await screen.findByText("secret page")).toBeInTheDocument();
    expect(calls.filter((c) => c === "POST /api/v1/auth/refresh")).toHaveLength(1);
  });

  it("redirects to login with the current path when there is no session", async () => {
    routes["POST /api/v1/auth/refresh"] = () => Response.json({ code: "IDENTITY_REFRESH_INVALID", status: 401 }, { status: 401 });
    window.history.pushState({}, "", "/calendar?month=5");
    renderGate();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?next=%2Fcalendar%3Fmonth%3D5"));
    expect(screen.queryByText("secret page")).not.toBeInTheDocument();
  });

  it("shows a retryable error when the server is unreachable", async () => {
    routes["POST /api/v1/auth/refresh"] = () => Promise.reject(new TypeError("Failed to fetch"));
    renderGate();
    expect(await screen.findByRole("alert")).toHaveTextContent(pl.errors.NETWORK_ERROR);
    routes["POST /api/v1/auth/refresh"] = () => Response.json({ accessToken: "t1", tokenType: "Bearer", expiresIn: 900 });
    await userEvent.click(screen.getByRole("button", { name: pl.errors.retry }));
    expect(await screen.findByText("secret page")).toBeInTheDocument();
  });

  it("signs out and redirects", async () => {
    renderGate();
    await screen.findByText("secret page");
    await act(() => userEvent.click(screen.getByRole("button", { name: "out" })));
    expect(calls).toContain("POST /api/v1/auth/logout");
    await waitFor(() => expect(replace).toHaveBeenCalled());
  });
});

describe("safeNext", () => {
  it("keeps local paths and rejects other sites", () => {
    expect(safeNext("/calendar?x=1")).toBe("/calendar?x=1");
    expect(safeNext("//evil.example")).toBe("/dashboard");
    expect(safeNext("https://evil.example")).toBe("/dashboard");
    expect(safeNext("/\\evil.example")).toBe("/dashboard");
    expect(safeNext(null)).toBe("/dashboard");
  });
});
