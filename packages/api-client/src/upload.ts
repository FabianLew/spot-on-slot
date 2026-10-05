import { ApiProblemError, NetworkError, unwrap, type ApiClient, type ApiSchemas } from "./index";

export type MediaImage = ApiSchemas["MediaResponse"];

/**
 * Uploads an image in the backend's three steps: ask for a presigned link, PUT the file straight to storage,
 * then let the backend turn it into WebP variants. Throws `ApiProblemError` (backend codes, or
 * `MEDIA_UPLOAD_FAILED` when storage refuses the PUT) or `NetworkError`.
 */
export async function uploadImage(client: ApiClient, file: File): Promise<MediaImage> {
  const upload = unwrap(
    await client.POST("/api/v1/media/uploads", { body: { contentType: file.type, size: file.size } }),
  );

  // Plain fetch: the link carries its own signature, and the API's bearer token must not reach storage.
  let response: Response;
  try {
    response = await globalThis.fetch(
      new Request(upload.url, { method: upload.method, headers: upload.headers, body: file }),
    );
  } catch (error) {
    throw new NetworkError({ cause: error });
  }
  if (!response.ok) {
    throw new ApiProblemError({
      type: "about:blank",
      title: "",
      status: response.status,
      code: "MEDIA_UPLOAD_FAILED",
      requestId: "",
    });
  }

  return unwrap(
    await client.POST("/api/v1/media/uploads/{uploadId}/complete", {
      params: { path: { uploadId: upload.uploadId } },
    }),
  );
}
