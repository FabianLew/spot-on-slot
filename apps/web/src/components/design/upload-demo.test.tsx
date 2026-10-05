import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import pl from "../../../messages/pl.json";
import { UploadDemo } from "./upload-demo";

const image = {
  id: "m1",
  width: 1600,
  height: 900,
  variants: { small: "http://s3.test/s.webp", medium: "http://s3.test/m.webp", large: "http://s3.test/l.webp" },
};

let complete: () => Response;
const fetchMock = vi.fn(async (request: Request) => {
  const url = new URL(request.url);
  if (url.host === "s3.test") return new Response(null, { status: 200 });
  if (url.pathname === "/api/v1/media/uploads") {
    return Response.json(
      { uploadId: "u1", url: "http://s3.test/uploads/u1", method: "PUT", headers: {}, expiresAt: "2026-10-05T20:00:00Z" },
      { status: 201 },
    );
  }
  if (url.pathname === "/api/v1/media/uploads/u1/complete") return complete();
  return new Response(null, { status: 404 });
});

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  complete = () => Response.json(image, { status: 201 });
});

function renderDemo() {
  render(
    <NextIntlClientProvider locale="pl" messages={pl}>
      <QueryClientProvider client={new QueryClient()}>
        <UploadDemo />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

const choose = () => screen.getByLabelText(pl.design.upload.choose);

describe("UploadDemo", () => {
  it("uploads the photo and lists the stored sizes", async () => {
    renderDemo();
    await userEvent.upload(choose(), new File(["x"], "a.jpg", { type: "image/jpeg" }));
    expect(await screen.findByText("Mały: 320 × 180 px")).toBeInTheDocument();
    expect(screen.getByText("Duży: 1600 × 900 px")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: pl.design.upload.previewAlt })).toHaveAttribute("src", image.variants.medium);
  });

  it("refuses big files before uploading", async () => {
    renderDemo();
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" });
    await userEvent.upload(choose(), big);
    expect(screen.getByRole("alert")).toHaveTextContent(pl.design.upload.tooLarge);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the backend message when processing fails", async () => {
    complete = () =>
      Response.json(
        { type: "about:blank", title: "x", status: 400, code: "MEDIA_INVALID_IMAGE", detail: "Nieprawidłowe zdjęcie.", requestId: "r" },
        { status: 400 },
      );
    renderDemo();
    await userEvent.upload(choose(), new File(["x"], "a.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nieprawidłowe zdjęcie.");
  });
});
