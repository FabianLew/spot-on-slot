package pl.spotonslot.waitlist;

/**
 * A waitlist sign-up needs its e-mail address confirmed: send {@code token} to {@code email} in {@code locale}.
 * The token is the raw value; only its hash is stored.
 */
public record WaitlistConfirmationRequested(String email, String locale, String token) {
}
