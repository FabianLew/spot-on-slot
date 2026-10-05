package pl.spotonslot.media.api;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

/**
 * @param width width of the large variant
 * @param height height of the large variant
 */
record MediaResponse(
        @Schema(requiredMode = REQUIRED) UUID id,
        @Schema(requiredMode = REQUIRED, description = "Width of the large variant") int width,
        @Schema(requiredMode = REQUIRED, description = "Height of the large variant") int height,
        @Schema(requiredMode = REQUIRED) Variants variants) {

    /** Public WebP URLs by the longer side: 320, 800 and 1600 px (smaller originals are never upscaled). */
    @Schema(name = "MediaVariants")
    record Variants(
            @Schema(requiredMode = REQUIRED, description = "320 px") String small,
            @Schema(requiredMode = REQUIRED, description = "800 px") String medium,
            @Schema(requiredMode = REQUIRED, description = "1600 px") String large) {
    }
}
