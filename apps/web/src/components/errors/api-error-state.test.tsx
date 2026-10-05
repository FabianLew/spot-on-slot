import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { NetworkError } from "@spot-on-slot/api-client";
import { describe, expect, it, vi } from "vitest";
import messages from "../../../messages/pl.json";
import { ApiProblemError, toApiProblem } from "@/lib/api-error";
import { ApiErrorState } from "./api-error-state";

function renderState(error: unknown, onRetry?: () => void) {
  return render(
    <NextIntlClientProvider locale="pl" messages={messages}>
      <ApiErrorState error={error} onRetry={onRetry} />
    </NextIntlClientProvider>,
  );
}

describe("ApiErrorState", () => {
  it("shows backend title, detail and request id", () => {
    renderState(
      new ApiProblemError({
        type: "about:blank",
        title: "Konflikt",
        status: 409,
        detail: "Termin jest zajęty",
        code: "SLOT_TAKEN",
        requestId: "abc-123",
      }),
    );
    expect(screen.getByText("Konflikt")).toBeInTheDocument();
    expect(screen.getByText("Termin jest zajęty")).toBeInTheDocument();
    expect(screen.getByText("ID zgłoszenia: abc-123")).toBeInTheDocument();
  });

  it("falls back to the translated network message and omits the request id", () => {
    renderState(toApiProblem(new NetworkError()));
    expect(screen.getByText(messages.errors.title)).toBeInTheDocument();
    expect(screen.getByText(messages.errors.NETWORK_ERROR)).toBeInTheDocument();
    expect(screen.queryByText(/ID zgłoszenia/)).not.toBeInTheDocument();
  });

  it("falls back to INTERNAL_ERROR text for unknown errors", () => {
    renderState(new Error("boom"));
    expect(screen.getByText(messages.errors.INTERNAL_ERROR)).toBeInTheDocument();
  });

  it("calls onRetry from the retry button and hides it without onRetry", async () => {
    const onRetry = vi.fn();
    const { unmount } = renderState(new Error("x"), onRetry);
    await userEvent.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    unmount();
    renderState(new Error("x"));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
