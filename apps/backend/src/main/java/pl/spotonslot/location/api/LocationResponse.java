package pl.spotonslot.location.api;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import pl.spotonslot.location.domain.LocationSource;

record LocationResponse(
        @Schema(requiredMode = REQUIRED, example = "Kraków, małopolskie") String label,
        @Schema(requiredMode = REQUIRED, example = "Kraków") String city,
        @Schema(example = "małopolskie") String region,
        @Schema(example = "PL") String countryCode,
        @Schema(requiredMode = REQUIRED, description = "Approximated to about 1 km") double latitude,
        @Schema(requiredMode = REQUIRED, description = "Approximated to about 1 km") double longitude,
        @Schema(requiredMode = REQUIRED) LocationSource source,
        @Schema(requiredMode = REQUIRED) Instant updatedAt) {
}
