import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SPOTLIGHT_R } from "./hero.config";
import { RevealLayer } from "./reveal-layer";

type FakeContext = {
  gradients: { args: number[]; stops: [number, string][] }[];
  clearRect: ReturnType<typeof vi.fn>;
  beginPath: ReturnType<typeof vi.fn>;
  arc: ReturnType<typeof vi.fn>;
  fill: ReturnType<typeof vi.fn>;
  createRadialGradient: ReturnType<typeof vi.fn>;
  fillStyle: unknown;
};

let ctx: FakeContext;

beforeEach(() => {
  ctx = {
    gradients: [],
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    createRadialGradient: vi.fn((...args: number[]) => {
      const gradient = { args, stops: [] as [number, string][] };
      ctx.gradients.push(gradient);
      return { addColorStop: (offset: number, color: string) => gradient.stops.push([offset, color]) };
    }),
    fillStyle: null,
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => ctx as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:mask");
});

afterEach(() => vi.restoreAllMocks());

function revealDiv(container: HTMLElement) {
  return container.querySelector("div.z-30") as HTMLDivElement;
}

describe("RevealLayer", () => {
  it("renders a hidden canvas sized to the viewport and the reveal image", () => {
    const { container } = render(<RevealLayer image="/hero/reveal.webp" cursorX={-999} cursorY={-999} />);
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    expect(canvas).toHaveStyle({ display: "none" });
    expect(canvas.width).toBe(window.innerWidth);
    expect(canvas.height).toBe(window.innerHeight);
    const reveal = revealDiv(container);
    expect(reveal).toHaveClass("absolute inset-0 bg-center bg-cover bg-no-repeat z-30 pointer-events-none");
    expect(reveal.style.backgroundImage).toBe('url("/hero/reveal.webp")');
  });

  it("resizes the canvas with the window", () => {
    const { innerWidth, innerHeight } = window;
    const { container } = render(<RevealLayer image="/hero/reveal.webp" cursorX={-999} cursorY={-999} />);
    try {
      window.innerWidth = 500;
      window.innerHeight = 400;
      window.dispatchEvent(new Event("resize"));
      const canvas = container.querySelector("canvas") as HTMLCanvasElement;
      expect(canvas.width).toBe(500);
      expect(canvas.height).toBe(400);
    } finally {
      window.innerWidth = innerWidth;
      window.innerHeight = innerHeight;
    }
  });

  it("rebuilds the mask with the exact gradient when the cursor moves", () => {
    const { container, rerender } = render(
      <RevealLayer image="/hero/reveal.webp" cursorX={-999} cursorY={-999} />,
    );
    rerender(<RevealLayer image="/hero/reveal.webp" cursorX={300} cursorY={200} />);

    const last = ctx.gradients.at(-1)!;
    expect(last.args).toEqual([300, 200, 0, 300, 200, SPOTLIGHT_R]);
    expect(SPOTLIGHT_R).toBe(260);
    expect(last.stops).toEqual([
      [0, "rgba(255,255,255,1)"],
      [0.4, "rgba(255,255,255,1)"],
      [0.6, "rgba(255,255,255,0.75)"],
      [0.75, "rgba(255,255,255,0.4)"],
      [0.88, "rgba(255,255,255,0.12)"],
      [1, "rgba(255,255,255,0)"],
    ]);
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenLastCalledWith(300, 200, SPOTLIGHT_R, 0, Math.PI * 2);
    expect(ctx.fill).toHaveBeenCalled();

    const reveal = revealDiv(container);
    expect(reveal.style.maskImage).toBe('url("data:mask")');
    expect(reveal.style.getPropertyValue("-webkit-mask-image")).toBe('url("data:mask")');
    expect(reveal.style.maskSize).toBe("100% 100%");
  });
});
