import { describe, expect, it } from "vitest";
import { ApiProblemError, NetworkError, toApiProblem, unwrap, type ApiProblem } from "./index";

const backend: ApiProblem = {
  type: "about:blank",
  title: "Nie znaleziono",
  status: 404,
  detail: "Brak takiego ogłoszenia",
  code: "LISTING_NOT_FOUND",
  requestId: "req-1",
};

describe("toApiProblem", () => {
  it("returns a backend problem unchanged", () => {
    expect(toApiProblem(backend, 404)).toBe(backend);
  });

  it("maps a NetworkError to NETWORK_ERROR with status 0", () => {
    const p = toApiProblem(new NetworkError());
    expect(p).toMatchObject({ code: "NETWORK_ERROR", status: 0, title: "", requestId: "" });
  });

  it("maps a code-bug TypeError to INTERNAL_ERROR, not a network error", () => {
    const p = toApiProblem(new TypeError("x is not a function"));
    expect(p).toMatchObject({ code: "INTERNAL_ERROR", status: 500 });
  });

  it("maps a non-problem body (HTML string) to INTERNAL_ERROR keeping the HTTP status", () => {
    const p = toApiProblem("<html>Bad Gateway</html>", 502);
    expect(p).toMatchObject({ code: "INTERNAL_ERROR", status: 502, title: "" });
  });

  it("maps undefined to INTERNAL_ERROR 500", () => {
    expect(toApiProblem(undefined)).toMatchObject({ code: "INTERNAL_ERROR", status: 500 });
  });

  it("never throws on odd input", () => {
    for (const v of [null, 0, "", {}, { code: 1, status: "x" }, [], Symbol("s")]) {
      expect(() => toApiProblem(v)).not.toThrow();
      expect(toApiProblem(v).code).toBe("INTERNAL_ERROR");
    }
  });
});

describe("unwrap", () => {
  it("returns data on success", () => {
    expect(unwrap({ data: { a: 1 }, response: new Response() })).toEqual({ a: 1 });
  });

  it("throws ApiProblemError carrying the backend problem", () => {
    try {
      unwrap({ error: backend, response: new Response(null, { status: 404 }) });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ApiProblemError);
      expect((e as ApiProblemError).problem).toBe(backend);
    }
  });

  it("uses the response status for non-problem error bodies", () => {
    expect(() => unwrap({ error: "oops", response: new Response(null, { status: 503 }) })).toThrow(
      expect.objectContaining({ problem: expect.objectContaining({ code: "INTERNAL_ERROR", status: 503 }) }),
    );
  });

  it("returns undefined without throwing for a successful no-body response (204)", () => {
    expect(unwrap({ response: new Response(null, { status: 204 }) })).toBeUndefined();
  });

  it("throws INTERNAL_ERROR with the response status for a non-ok response without error body", () => {
    expect(() => unwrap({ response: new Response(null, { status: 502 }) })).toThrow(
      expect.objectContaining({ problem: expect.objectContaining({ code: "INTERNAL_ERROR", status: 502 }) }),
    );
  });
});
