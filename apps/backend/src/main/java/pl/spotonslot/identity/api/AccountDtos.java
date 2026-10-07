package pl.spotonslot.identity.api;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import pl.spotonslot.identity.DeletionBlocker;

/** Requests and responses of the account settings ({@code /api/v1/me/...}). */
final class AccountDtos {

    private AccountDtos() {
    }

    record ChangePasswordRequest(
            @NotBlank @Size(max = 128) @Schema(requiredMode = REQUIRED) String currentPassword,
            @NotNull @Size(min = 10, max = 128) @Schema(requiredMode = REQUIRED) String newPassword) {
    }

    record ChangeEmailRequest(
            @NotBlank @Email @Size(max = 254) @Schema(requiredMode = REQUIRED) String newEmail,
            @NotBlank @Size(max = 128) @Schema(requiredMode = REQUIRED) String currentPassword) {
    }

    /** {@code confirm} is the "I understand" checkbox and must be true. */
    record DeletionRequest(
            @NotBlank @Size(max = 128) @Schema(requiredMode = REQUIRED) String password,
            @AssertTrue @Schema(requiredMode = REQUIRED) boolean confirm) {
    }

    record DeletionScheduledResponse(@Schema(requiredMode = REQUIRED) Instant deletionScheduledAt) {
    }

    /** What deleting the account now would mean; {@code blockers} must be settled first (empty = it can go). */
    record DeletionCheckResponse(
            @Schema(requiredMode = REQUIRED) List<DeletionBlockerResponse> blockers,
            @Schema(requiredMode = REQUIRED, description = "Days the account can still be restored after the request")
            long graceDays) {
    }

    /** For {@code LAST_VENUE_OWNER}: {@code id} and {@code name} are the venue's (link to its team page). */
    @Schema(name = "DeletionBlocker")
    record DeletionBlockerResponse(
            @Schema(requiredMode = REQUIRED) DeletionBlocker.Kind kind,
            @Schema(requiredMode = REQUIRED) UUID id,
            @Schema(requiredMode = REQUIRED) String name) {

        static DeletionBlockerResponse of(DeletionBlocker blocker) {
            return new DeletionBlockerResponse(blocker.kind(), blocker.id(), blocker.name());
        }
    }
}
