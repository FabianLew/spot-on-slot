package pl.spotonslot.identity;

/**
 * An account's e-mail address needs verifying: send {@code token} to {@code email} in {@code locale}.
 * The token is the raw value; only its hash is stored.
 */
public record EmailVerificationRequested(String email, String locale, String token) {
}
