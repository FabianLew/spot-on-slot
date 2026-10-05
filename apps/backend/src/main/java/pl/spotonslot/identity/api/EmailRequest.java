package pl.spotonslot.identity.api;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** An e-mail address for "resend verification link" and "forgot password". */
public record EmailRequest(@NotBlank @Email @Size(max = 254) String email) {
}
