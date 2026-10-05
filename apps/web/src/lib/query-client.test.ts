import { describe, expect, it, vi } from "vitest";
import { ApiProblemError, toApiProblem } from "./api-error";
import { createQueryClient } from "./query-client";

const problemError = (status: number) =>
  new ApiProblemError({ type: "about:blank", title: "t", status, code: "X", requestId: "r" });

function retryFn() {
  const retry = createQueryClient(() => {}).getDefaultOptions().queries!.retry as (
    count: number,
    error: unknown,
  ) => boolean;
  return retry;
}

describe("createQueryClient retry", () => {
  it("does not retry 4xx", () => {
    expect(retryFn()(0, problemError(404))).toBe(false);
  });
  it("retries 5xx twice then stops", () => {
    const retry = retryFn();
    expect(retry(0, problemError(500))).toBe(true);
    expect(retry(1, problemError(500))).toBe(true);
    expect(retry(2, problemError(500))).toBe(false);
  });
  it("retries network errors and unknown errors", () => {
    expect(retryFn()(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(toApiProblem(new TypeError("x")).status).toBe(0);
  });
});

describe("createQueryClient mutation errors", () => {
  it("reports a failing mutation once, as a problem", async () => {
    const onError = vi.fn();
    const client = createQueryClient(onError);
    await client
      .getMutationCache()
      .build(client, { mutationFn: async () => Promise.reject(problemError(400)) })
      .execute(undefined)
      .catch(() => {});
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]![0]).toMatchObject({ status: 400 });
  });

  it("skips mutations that handle their own errors", async () => {
    const onError = vi.fn();
    const client = createQueryClient(onError);
    await client
      .getMutationCache()
      .build(client, { mutationFn: async () => Promise.reject(problemError(400)), meta: { handlesErrors: true } })
      .execute(undefined)
      .catch(() => {});
    expect(onError).not.toHaveBeenCalled();
  });
});
