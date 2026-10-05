package pl.spotonslot.waitlist.api;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import pl.spotonslot.waitlist.application.SignupCommand;
import pl.spotonslot.waitlist.domain.WaitlistRole;

/**
 * Waitlist sign-up form. {@code website} is a hidden honeypot field. Text fields are trimmed before validation.
 * {@code role} is a string so an unknown value is a field validation error rather than an unreadable body.
 */
public record SignupRequest(
        @NotBlank @Email @Size(max = 254) String email,
        @NotNull @Pattern(regexp = "ARTIST|BOOKER|VENUE") String role,
        @NotBlank @Size(min = 2, max = 100) String city,
        @NotNull @Pattern(regexp = "pl|en") String locale,
        @AssertTrue boolean consent,
        String website) {

    public SignupRequest {
        email = email == null ? null : email.trim();
        city = city == null ? null : city.trim();
    }

    SignupCommand toCommand() {
        return new SignupCommand(email, WaitlistRole.valueOf(role), city, locale, website);
    }
}
