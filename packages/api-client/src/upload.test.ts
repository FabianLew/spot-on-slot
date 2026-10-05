import { describe, expect, it, vi } from "vitest";
import { ApiProblemError, createApiClient, NetworkError, uploadImage } from "./index";

const media = {
  id: "m1",
  width: 1600,
  height: 900,
  variants: { small: "http://s3/s.webp", medium: "http://s3/m.webp", large: "http://s3/l.webp" },
};

function setup(put: (request: Request) => Response | Promise<Response>) {
  const calls: Request[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      calls.push(request);
      const url = new URL(request.url);
      if (url.host === "storage.test") return put(request);
      if (url.pathname === "/api/v1/media/uploads") {
        return Response.json(
          { uploadId: "u1", url: "http://storage.test/bucket/uploads/u1?X-Amz-Signature=abc", method: "PUT", headers: { "content-type": "image/png" }, expiresAt: "2026-10-05T20:00:00Z" },
          { status: 201 },
        );
      }
      if (url.pathname === "/api/v1/media/uploads/u1/complete") return Response.json(media, { status: 201 });
      return new Response(null, { status: 404 });
    }),
  );
  return { client: createApiClient({ baseUrl: "http://api.test", getAccessToken: () => "t" }), calls };
}

const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "photo.png", { type: "image/png" });

describe("uploadImage", () => {
  it("requests a link, sends the file to storage and completes the upload", async () => {
    const { client, calls } = setup(() => new Response(null, { status: 200 }));
    await expect(uploadImage(client, file)).resolves.toEqual(media);

    const [start, put, complete] = calls;
    expect(await start!.json()).toEqual({ contentType: "image/png", size: 4 });
    expect(put!.method).toBe("PUT");
    expect(put!.headers.get("content-type")).toBe("image/png");
    // The storage link carries its own signature; the API token must not leak to it.
    expect(put!.headers.has("Authorization")).toBe(false);
    expect(new Uint8Array(await put!.arrayBuffer())).toEqual(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
    expect(new URL(complete!.url).pathname).toBe("/api/v1/media/uploads/u1/complete");
  });

  it("reports a rejected storage upload as MEDIA_UPLOAD_FAILED", async () => {
    const { client } = setup(() => new Response("<Error/>", { status: 403 }));
    const error = await uploadImage(client, file).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiProblemError);
    expect((error as ApiProblemError).problem).toMatchObject({ code: "MEDIA_UPLOAD_FAILED", status: 403 });
  });

  it("reports an unreachable storage as a network error", async () => {
    const { client } = setup(() => Promise.reject(new TypeError("Failed to fetch")));
    await expect(uploadImage(client, file)).rejects.toBeInstanceOf(NetworkError);
  });
});
