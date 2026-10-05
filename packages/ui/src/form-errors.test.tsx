import { act, render, renderHook } from "@testing-library/react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { applyServerErrors, translateFormError } from "./form-errors";

type ApiProblem = Parameters<typeof applyServerErrors>[1];

const base: ApiProblem = { title: "Błąd" };

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
        errors: [{ field: "email", message: "zły" }],
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
          { field: "email", message: "zły" },
          { field: "nickname", message: "zajęty" },
        ],
      }),
    );
    expect(result.current.formState.errors.email?.message).toBe("zły");
    expect(result.current.formState.errors.root?.server?.message).toBe("zajęty");
  });

  it("puts detail of a problem without errors into the root error", () => {
    const { result } = setup();
    act(() =>
      applyServerErrors(result.current, { ...base, detail: "Konflikt" }),
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

describe("applyServerErrors with registered fields", () => {
  type Values = { nick?: string; address: { zip?: string }; items: { name?: string }[] };
  let form: UseFormReturn<Values>;
  let errors: Record<string, unknown>;

  function Harness({ register }: { register: string[] }) {
    form = useForm<Values>({ defaultValues: { address: {}, items: [{}] } });
    errors = form.formState.errors;
    return (
      <form>
        {register.map((name) => (
          <input key={name} aria-label={name} {...form.register(name as never)} />
        ))}
      </form>
    );
  }
  const problem = (field: string): ApiProblem => ({
    ...base,
    errors: [{ field, message: "zły" }],
  });

  it("pins errors on a registered field whose value is undefined", () => {
    render(<Harness register={["nick"]} />);
    act(() => applyServerErrors(form, problem("nick")));
    expect(errors.nick).toMatchObject({ message: "zły" });
    expect(form.formState.errors.root).toBeUndefined();
  });

  it("pins errors on a nested registered field under an empty parent", () => {
    render(<Harness register={["address.zip"]} />);
    act(() => applyServerErrors(form, problem("address.zip")));
    expect((errors.address as { zip?: { message: string } }).zip?.message).toBe("zły");
    expect(form.formState.errors.root).toBeUndefined();
  });

  it("normalizes bracket paths to registered dotted names", () => {
    render(<Harness register={["items.0.name"]} />);
    act(() => applyServerErrors(form, problem("items[0].name")));
    expect((errors.items as { name?: { message: string } }[])[0]?.name?.message).toBe("zły");
    expect(form.formState.errors.root).toBeUndefined();
  });

  it("still sends unregistered fields to the root error", () => {
    render(<Harness register={["nick"]} />);
    act(() => applyServerErrors(form, problem("address.zip")));
    expect(form.formState.errors.root?.server?.message).toBe("zły");
  });
});
