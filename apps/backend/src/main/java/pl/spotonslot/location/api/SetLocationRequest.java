package pl.spotonslot.location.api;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import pl.spotonslot.location.domain.LocationSource;

/** Exact coordinates from the device or a picked suggestion; the server keeps only an approximation. */
record SetLocationRequest(
        @NotNull @DecimalMin("-90") @DecimalMax("90") @Schema(requiredMode = REQUIRED) Double latitude,
        @NotNull @DecimalMin("-180") @DecimalMax("180") @Schema(requiredMode = REQUIRED) Double longitude,
        @NotNull @Schema(requiredMode = REQUIRED) LocationSource source) {
}
