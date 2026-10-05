package pl.spotonslot.identity.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record PasswordResetConfirmRequest(
        @NotBlank @Size(max = 100) String token,
        @NotNull @Size(min = 10, max = 128) String password) {
}
