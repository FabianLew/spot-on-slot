import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ChoiceChips } from "./index";

const options = [
  { value: "TECHNO", label: "Techno" },
  { value: "HOUSE", label: "House" },
  { value: "DISCO", label: "Disco" },
];

function Controlled({ max, onChange }: { max?: number; onChange?: (value: string[]) => void }) {
  const [value, setValue] = useState<string[]>(["TECHNO"]);
  return (
    <ChoiceChips
      legend="Gatunki"
      options={options}
      value={value}
      max={max}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe("ChoiceChips", () => {
  it("toggles options in the order they were picked", async () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);

    expect(screen.getByRole("group", { name: "Gatunki" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Techno" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Disco" }));
    expect(onChange).toHaveBeenLastCalledWith(["TECHNO", "DISCO"]);
    await userEvent.click(screen.getByRole("button", { name: "Techno" }));
    expect(onChange).toHaveBeenLastCalledWith(["DISCO"]);
  });

  it("disables the rest once the limit is reached", async () => {
    render(<Controlled max={2} />);
    await userEvent.click(screen.getByRole("button", { name: "House" }));

    expect(screen.getByRole("button", { name: "Disco" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "House" })).toBeEnabled();
  });

  it("shows an error with an icon", () => {
    const { container } = render(
      <ChoiceChips legend="Gatunki" options={options} value={[]} onChange={vi.fn()} error="Wybierz gatunek" />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Wybierz gatunek");
    expect(container.querySelector("[role=alert] svg")).not.toBeNull();
  });
});
