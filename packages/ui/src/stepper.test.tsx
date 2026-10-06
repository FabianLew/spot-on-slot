import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Stepper } from "./index";

describe("Stepper", () => {
  it("marks done, current and upcoming steps and says where you are", () => {
    render(<Stepper steps={["Dane", "Zdjęcie", "Lokalizacja"]} current={1} label="Krok 2 z 3" />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveAttribute("data-state", "done");
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[1]).toHaveAttribute("data-state", "current");
    expect(items[2]).toHaveAttribute("data-state", "upcoming");
    expect(screen.getByText("Krok 2 z 3")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Krok 2 z 3" })).toBeInTheDocument();
  });
});
