import { act, renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import type { ApiProblem } from "./api-error";
import { applyServerErrors, translateFormError } from "./forms";

const base: ApiProblem = {
  type: "about:blank",
  title: "Błąd",
  status: 400,
  code: "VALIDATION_FAILED",
  requestId: "r1",
};

function setup() {
  return renderHook(() => {
    const form = useForm({ defaultValues: { email: "" } });
    void form.formState.errors; // subscribe to errors, as a rendering form would
    return form;
  });
}

describe("applyServerErrors", () => {
  it("maps an error entry onto its registered field", () => {
    const { result } = setup();
    act(() =>
      applyServerErrors(result.current, {
        ...base,
        errors: [{ field: "email", code: "X", message: "zły" }],
      }),
    );
    expect(result.current.formState.errors.email?.message).toBe("zły");
    expect(result.current.formState.errors.email?.type).toBe("server");
    expect(result.current.formState.errors.root?.server).toBeUndefined();
  });

  it("sends entries for unknown fields to the root error", () => {
    const { result } = setup();
    act(() =>
      applyServerErrors(result.current, {
        ...base,
        errors: [
          { field: "email", code: "X", message: "zły" },
          { field: "nickname", code: "Y", message: "zajęty" },
        ],
      }),
    );
    expect(result.current.formState.errors.email?.message).toBe("zły");
    expect(result.current.formState.errors.root?.server?.message).toBe("zajęty");
  });

  it("puts detail of a problem without errors into the root error", () => {
    const { result } = setup();
    act(() =>
      applyServerErrors(result.current, { ...base, status: 409, code: "CONFLICT", detail: "Konflikt" }),
    );
    expect(result.current.formState.errors.root?.server?.message).toBe("Konflikt");
  });
});

describe("translateFormError", () => {
  const t = Object.assign((k: string) => `T:${k}`, { has: (k: string) => k === "validation.required" });
  it("translates known validation keys and passes everything else through", () => {
    const translate = translateFormError(t);
    expect(translate("validation.required")).toBe("T:validation.required");
    expect(translate("validation.unknown")).toBe("validation.unknown");
    expect(translate("Konflikt")).toBe("Konflikt");
  });
});
