package pl.spotonslot.identity.api;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import pl.spotonslot.identity.Role;
import pl.spotonslot.identity.application.RegisterCommand;

/**
 * Registration form. {@code role} is a string so an unknown value is a field validation error rather than an
 * unreadable body; only ARTIST and VENUE can register themselves. {@code acceptTerms} (terms of service and privacy
 * policy) must be true; the accepted version comes from configuration.
 */
public record RegisterRequest(
        @NotBlank @Email @Size(max = 254) String email,
        @NotNull @Size(min = 10, max = 128) String password,
        @NotNull @Pattern(regexp = "ARTIST|VENUE") String role,
        @NotNull @Pattern(regexp = "pl|en") String locale,
        @AssertTrue boolean privacyNoticeAccepted,
        @AssertTrue boolean acceptTerms) {

    public RegisterRequest {
        email = email == null ? null : email.trim();
    }

    RegisterCommand toCommand() {
        return new RegisterCommand(email, password, Role.valueOf(role), locale);
    }
}
