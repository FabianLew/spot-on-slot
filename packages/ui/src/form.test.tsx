import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm, type UseFormReturn } from "react-hook-form";
import { describe, expect, it } from "vitest";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRootError,
  Input,
} from "./index";

type Values = { name: string };

function TestForm({
  onReady,
  translateError,
}: {
  onReady?: (form: UseFormReturn<Values>) => void;
  translateError?: (message: string) => string;
}) {
  const form = useForm<Values>({ defaultValues: { name: "" } });
  onReady?.(form);
  return (
    <Form {...form} translateError={translateError}>
      <form onSubmit={form.handleSubmit(() => {})}>
        <FormRootError />
        <FormField
          control={form.control}
          name="name"
          rules={{ required: "validation.required" }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Imię</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>Podpowiedź</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <button type="submit">Wyślij</button>
      </form>
    </Form>
  );
}

describe("Form", () => {
  it("shows the translated field error with an icon and wires aria attributes", async () => {
    const user = userEvent.setup();
    render(<TestForm translateError={(k) => "T:" + k} />);
    const input = screen.getByLabelText("Imię");
    expect(input).toHaveAttribute("aria-invalid", "false");
    await user.click(screen.getByRole("button", { name: "Wyślij" }));
    const message = await screen.findByText("T:validation.required");
    expect(message.closest("p")?.querySelector("svg")).not.toBeNull();
    expect(message.closest("p")).toHaveClass("text-danger");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    expect(describedBy).toContain(message.closest("p")!.id);
    expect(describedBy).toContain(screen.getByText("Podpowiedź").id);
  });

  it("shows the raw message when translateError is not given", async () => {
    const user = userEvent.setup();
    render(<TestForm />);
    await user.click(screen.getByRole("button", { name: "Wyślij" }));
    expect(await screen.findByText("validation.required")).toBeInTheDocument();
  });

  it.each(["root", "root.server"] as const)(
    "renders setError(%s) in FormRootError as an alert with icon",
    async (key) => {
      let form!: UseFormReturn<Values>;
      render(<TestForm onReady={(f) => (form = f)} translateError={(k) => "T:" + k} />);
      form.setError(key, { message: "boom" });
      const alert = await screen.findByRole("alert");
      await waitFor(() => expect(alert).toHaveTextContent("T:boom"));
      expect(alert.querySelector("svg")).not.toBeNull();
      expect(alert).toHaveClass("text-danger");
    },
  );
});
