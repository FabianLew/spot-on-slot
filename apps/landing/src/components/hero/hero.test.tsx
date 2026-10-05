import { act, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import pl from "../../../messages/pl.json";
import { Hero } from "./hero";
import { HERO_CTA_COLOR, HERO_CTA_HOVER_COLOR, SPOTLIGHT_R } from "./hero.config";

let gradientArgs: number[][];
let frames: FrameRequestCallback[];

beforeEach(() => {
  gradientArgs = [];
  frames = [];
  const ctx = {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    createRadialGradient: (...args: number[]) => {
      gradientArgs.push(args);
      return { addColorStop: vi.fn() };
    },
    fillStyle: null,
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => ctx as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:mask");
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => frames.push(callback)),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderHero() {
  return render(
    <NextIntlClientProvider locale="pl" messages={pl}>
      <Hero />
    </NextIntlClientProvider>,
  );
}

describe("Hero", () => {
  it("renders the headline and both descriptions from messages", () => {
    renderHero();
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(`${pl.hero.headlineLine1}${pl.hero.headlineLine2}`);
    expect(screen.getByText(pl.hero.headlineLine1)).toHaveClass("font-playfair italic hero-reveal");
    expect(screen.getByText(pl.hero.headlineLine1)).toHaveStyle({ animationDelay: "0.25s" });
    expect(screen.getByText(pl.hero.headlineLine2)).toHaveStyle({ animationDelay: "0.42s" });
    expect(screen.getByText(pl.hero.descriptionLeft)).toBeInTheDocument();
    expect(screen.getByText(pl.hero.descriptionRight)).toBeInTheDocument();
  });

  it("links the CTA to the waitlist section in the accent colour", () => {
    renderHero();
    const cta = screen.getByRole("link", { name: pl.hero.cta });
    expect(cta).toHaveAttribute("href", "#waitlist");
    expect(cta).toHaveClass("hero-cta");
    expect(cta.style.getPropertyValue("--hero-cta")).toBe(HERO_CTA_COLOR);
    expect(cta.style.getPropertyValue("--hero-cta-hover")).toBe(HERO_CTA_HOVER_COLOR);
  });

  it("centres the mask off-screen before any mouse movement", () => {
    renderHero();
    expect(gradientArgs).toEqual([[-999, -999, 0, -999, -999, SPOTLIGHT_R]]);
  });

  it("eases the spotlight towards the cursor on each animation frame", () => {
    renderHero();
    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 701, clientY: 451 }));
    });
    act(() => frames.at(-1)!(0));
    // smooth += (mouse - smooth) * 0.1, starting from -999
    expect(gradientArgs.at(-1)).toEqual([-829, -854, 0, -829, -854, SPOTLIGHT_R]);
    expect(frames.length).toBeGreaterThan(1);
  });

  it("listens to mousemove on mount and cleans up on unmount", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHero();
    const handler = add.mock.calls.find(([type]) => type === "mousemove")?.[1];
    expect(handler).toBeTypeOf("function");

    unmount();
    expect(remove).toHaveBeenCalledWith("mousemove", handler);
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});
