package pl.spotonslot.media.api;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Where to send the file: {@code PUT url} with exactly these {@code headers} and the file as the body, then
 * {@code POST /api/v1/media/uploads/{uploadId}/complete}.
 */
record UploadResponse(
        @Schema(requiredMode = REQUIRED) UUID uploadId,
        @Schema(requiredMode = REQUIRED) String url,
        @Schema(requiredMode = REQUIRED, allowableValues = "PUT") String method,
        @Schema(requiredMode = REQUIRED) Map<String, String> headers,
        @Schema(requiredMode = REQUIRED) Instant expiresAt) {
}
