package pl.spotonslot.location.api;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;
import pl.spotonslot.location.domain.Place;

/** A suggestion to show while the user types; save it by sending its coordinates to {@code PUT /me}. */
record PlaceResponse(
        @Schema(requiredMode = REQUIRED) Place.Kind kind,
        @Schema(requiredMode = REQUIRED, example = "Rynek Główny 1, Kraków") String label,
        @Schema(description = "Street with house number for an address", example = "Rynek Główny 1") String street,
        @Schema(example = "31-042") String postalCode,
        @Schema(requiredMode = REQUIRED, example = "Kraków") String city,
        @Schema(example = "małopolskie") String region,
        @Schema(example = "PL") String countryCode,
        @Schema(requiredMode = REQUIRED) double latitude,
        @Schema(requiredMode = REQUIRED) double longitude) {
}
