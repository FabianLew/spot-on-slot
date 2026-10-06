import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  ActionTile,
  MonthCalendar,
  monthGrid,
  PageHeader,
  Panel,
  PixelHeadphones,
  SkillMeter,
  SlotChip,
  StatTile,
  type DayState,
  type MonthCalendarLabels,
} from "./index";

const labels: MonthCalendarLabels = {
  weekdays: ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"],
  title: "Październik 2026",
  previousMonth: "Poprzedni miesiąc",
  nextMonth: "Następny miesiąc",
  available: "dostępny",
  selected: "wybrany",
  unavailable: "niedostępny",
  dayLabel: (d) => `${d.getDate()} października`,
};

const october = new Date(2026, 9, 1);
const open = new Set([12, 18, 25]);
const dayState = (d: Date): DayState => (open.has(d.getDate()) ? "available" : "unavailable");

describe("Panel and PageHeader", () => {
  it("renders the panel title as a heading", () => {
    render(<Panel title="O mnie">tekst</Panel>);
    expect(screen.getByRole("heading", { level: 2, name: "O mnie" })).toBeInTheDocument();
  });

  it("renders the page title as h1 with its slots", () => {
    render(<PageHeader title="Profil DJ-a" back={<a href="/">wstecz</a>} actions={<button>więcej</button>} />);
    expect(screen.getByRole("heading", { level: 1, name: "Profil DJ-a" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "wstecz" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "więcej" })).toBeInTheDocument();
  });
});

describe("SkillMeter", () => {
  it("exposes the value as a meter with a text readout", () => {
    render(<SkillMeter label="Energia" value={8} />);
    const meter = screen.getByRole("meter", { name: "Energia" });
    expect(meter).toHaveAttribute("aria-valuenow", "8");
    expect(meter).toHaveAttribute("aria-valuetext", "8/10");
    expect(meter.querySelectorAll("[data-filled]")).toHaveLength(8);
  });

  it("clamps values outside the range", () => {
    render(<SkillMeter label="CDJ" value={14} />);
    expect(screen.getByRole("meter", { name: "CDJ" })).toHaveAttribute("aria-valuenow", "10");
  });
});

describe("SlotChip and tiles", () => {
  it("marks the selected chip as pressed", () => {
    render(
      <>
        <SlotChip>12 paź</SlotChip>
        <SlotChip selected>18 paź</SlotChip>
      </>,
    );
    expect(screen.getByRole("button", { name: "12 paź" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "18 paź" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "18 paź" })).toHaveClass("bg-primary");
  });

  it("renders a stat as a term and value", () => {
    render(<StatTile label="DJ-e w pobliżu" value={24} />);
    expect(screen.getByText("DJ-e w pobliżu").tagName).toBe("DT");
    expect(screen.getByText("24").tagName).toBe("DD");
  });

  it("renders an action tile as a link with asChild, icon hidden", () => {
    render(
      <ActionTile asChild icon={<PixelHeadphones data-testid="icon" />}>
        <a href="/inbox">Skrzynka</a>
      </ActionTile>,
    );
    expect(screen.getByRole("link", { name: "Skrzynka" })).toHaveAttribute("href", "/inbox");
    expect(screen.getByTestId("icon")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("MonthCalendar", () => {
  it("starts the grid on Monday", () => {
    // 1 October 2026 is a Thursday: three blanks first.
    const grid = monthGrid(october);
    expect(grid.slice(0, 3)).toEqual([null, null, null]);
    expect(grid[3]?.getDate()).toBe(1);
    expect(grid).toHaveLength(3 + 31);
  });

  it("lets only available days be picked", async () => {
    const onSelect = vi.fn();
    render(
      <MonthCalendar month={october} labels={labels} dayState={dayState} onSelect={onSelect} onMonthChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "5 października, niedostępny" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "12 października, dostępny" }));
    expect(onSelect).toHaveBeenCalledWith(new Date(2026, 9, 12));
  });

  it("marks the selected day and makes it the tab stop", () => {
    render(
      <MonthCalendar
        month={october}
        labels={labels}
        dayState={dayState}
        selected={new Date(2026, 9, 18)}
        onSelect={vi.fn()}
        onMonthChange={vi.fn()}
      />,
    );
    const day = screen.getByRole("button", { name: "18 października, wybrany" });
    expect(day).toHaveAttribute("aria-pressed", "true");
    expect(day).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("button", { name: "12 października, dostępny" })).toHaveAttribute("tabindex", "-1");
  });

  it("moves focus between available days with the arrow keys", async () => {
    render(
      <MonthCalendar month={october} labels={labels} dayState={dayState} onSelect={vi.fn()} onMonthChange={vi.fn()} />,
    );
    screen.getByRole("button", { name: "12 października, dostępny" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "18 października, dostępny" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "25 października, dostępny" })).toHaveFocus();
  });

  it("lets every day be picked in selectAny mode and marks booked days", async () => {
    const onSelect = vi.fn();
    render(
      <MonthCalendar
        month={october}
        labels={{ ...labels, booked: "zarezerwowany" }}
        dayState={dayState}
        isBooked={(d) => d.getDate() === 25}
        selectAny
        selected={new Date(2026, 9, 5)}
        onSelect={onSelect}
        onMonthChange={vi.fn()}
      />,
    );
    const empty = screen.getByRole("button", { name: "5 października, niedostępny, wybrany" });
    expect(empty).toBeEnabled();
    expect(empty).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "25 października, dostępny, zarezerwowany" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "6 października, niedostępny" }));
    expect(onSelect).toHaveBeenCalledWith(new Date(2026, 9, 6));
    expect(screen.getByText("zarezerwowany")).toBeInTheDocument();
  });

  it("asks for the neighbouring month", async () => {
    const onMonthChange = vi.fn();
    render(
      <MonthCalendar
        month={october}
        labels={labels}
        dayState={dayState}
        onSelect={vi.fn()}
        onMonthChange={onMonthChange}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Następny miesiąc" }));
    expect(onMonthChange).toHaveBeenCalledWith(new Date(2026, 10, 1));
  });
});
