package pl.spotonslot.identity.api;

import io.swagger.v3.oas.annotations.media.Schema;

/** Short-lived bearer token; the refresh token travels in the {@code sos_refresh} HttpOnly cookie. */
public record AccessTokenResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String accessToken,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = "Bearer") String tokenType,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Seconds until the access token expires")
        long expiresIn) {
}
