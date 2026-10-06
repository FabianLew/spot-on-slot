import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { LocationPicker, type LocationPickerLabels } from "./index";

const labels: LocationPickerLabels = {
  search: "Miasto lub adres",
  placeholder: "np. Kraków",
  useDevice: "Użyj mojej lokalizacji",
  locating: "Ustalam lokalizację…",
  searching: "Szukam…",
  noResults: "Nic nie znaleziono",
};

const places = [{ label: "Kraków, małopolskie" }, { label: "Krakowska, Warszawa" }];

function Harness({
  onSelect = vi.fn(),
  onQueryChange = vi.fn(),
  suggestions = places,
  searching = false,
}: {
  onSelect?: (place: { label: string }) => void;
  onQueryChange?: (query: string) => void;
  suggestions?: { label: string }[];
  searching?: boolean;
}) {
  const [query, setQuery] = useState("");
  return (
    <LocationPicker
      labels={labels}
      query={query}
      onQueryChange={(value) => {
        setQuery(value);
        onQueryChange(value);
      }}
      suggestions={query.length >= 3 ? suggestions : []}
      searching={searching}
      onSelect={onSelect}
      onUseDevice={vi.fn()}
    />
  );
}

describe("LocationPicker", () => {
  it("lists suggestions once three characters are typed and picks one by click", async () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    const input = screen.getByRole("combobox", { name: labels.search });

    await userEvent.type(input, "kr");
    expect(screen.queryByRole("listbox")).toBeNull();

    await userEvent.type(input, "a");
    expect(input).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(screen.getByRole("option", { name: "Kraków, małopolskie" }));

    expect(onSelect).toHaveBeenCalledWith(places[0]);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("supports the keyboard", async () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    const input = screen.getByRole("combobox", { name: labels.search });

    await userEvent.type(input, "kra{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("option", { name: "Krakowska, Warszawa" })).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", screen.getAllByRole("option")[1]!.id);

    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith(places[1]);

    await userEvent.type(input, "x");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("says when nothing was found and while searching", async () => {
    const { unmount } = render(<Harness suggestions={[]} />);
    await userEvent.type(screen.getByRole("combobox"), "xyz");
    expect(screen.getByText(labels.noResults)).toBeInTheDocument();
    unmount();

    render(<Harness suggestions={[]} searching />);
    await userEvent.type(screen.getByRole("combobox"), "xyz");
    expect(screen.getByRole("status")).toHaveTextContent(labels.searching);
  });

  it("asks for the device location and shows an error with an icon", async () => {
    const onUseDevice = vi.fn();
    const { rerender, container } = render(
      <LocationPicker
        labels={labels}
        query=""
        onQueryChange={vi.fn()}
        suggestions={[]}
        onSelect={vi.fn()}
        onUseDevice={onUseDevice}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: labels.useDevice }));
    expect(onUseDevice).toHaveBeenCalled();

    rerender(
      <LocationPicker
        labels={labels}
        query=""
        onQueryChange={vi.fn()}
        suggestions={[]}
        onSelect={vi.fn()}
        onUseDevice={onUseDevice}
        locating
        error="Brak zgody na lokalizację"
      />,
    );
    expect(screen.getByRole("button", { name: labels.locating })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Brak zgody na lokalizację");
    expect(container.querySelector("[role=alert] svg")).not.toBeNull();
  });

  it("hides the location button when there is no device handler", () => {
    render(<LocationPicker labels={labels} query="" onQueryChange={vi.fn()} suggestions={[]} onSelect={vi.fn()} />);
    expect(screen.queryByRole("button", { name: labels.useDevice })).toBeNull();
  });
});
