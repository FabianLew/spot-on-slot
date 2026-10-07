package pl.spotonslot.identity.api;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.UUID;
import pl.spotonslot.identity.Role;

/**
 * The signed-in account. {@code termsAccepted} is false until the current {@code termsVersion} is accepted
 * ({@code POST /api/v1/me/terms}); {@code deletionScheduledAt} is set while the account waits for deletion, and then
 * only this, {@code POST /api/v1/me/deletion/cancel} and signing out work.
 */
public record MeResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String email,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Role role,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = {"pl", "en"}) String locale,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean termsAccepted,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The current version to accept")
        String termsVersion,
        @Schema(description = "When the account will be deleted for good; null unless deletion was requested")
        Instant deletionScheduledAt) {
}
