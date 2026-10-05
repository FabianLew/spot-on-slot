package pl.spotonslot.identity.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** The raw token from the link in the e-mail. */
public record TokenRequest(@NotBlank @Size(max = 100) String token) {
}
