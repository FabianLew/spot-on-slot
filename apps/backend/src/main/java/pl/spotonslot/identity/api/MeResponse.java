package pl.spotonslot.identity.api;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;
import pl.spotonslot.identity.Role;

public record MeResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String email,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Role role,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = {"pl", "en"}) String locale) {
}
