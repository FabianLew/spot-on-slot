package pl.spotonslot.waitlist.api;

import jakarta.validation.constraints.NotBlank;

/** The raw confirmation token from the link in the e-mail. */
public record ConfirmationRequest(@NotBlank String token) {
}
