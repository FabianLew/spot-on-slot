package pl.spotonslot.media.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

/**
 * @param contentType {@code image/jpeg}, {@code image/png} or {@code image/webp}
 * @param size file size in bytes
 */
record StartUploadRequest(
        @NotBlank @Schema(example = "image/jpeg") String contentType,
        @Positive @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "File size in bytes") long size) {
}
