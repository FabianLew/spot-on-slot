package pl.spotonslot.identity;

/** Send the password reset {@code token} (raw value, only its hash is stored) to {@code email} in {@code locale}. */
public record PasswordResetRequested(String email, String locale, String token) {
}
