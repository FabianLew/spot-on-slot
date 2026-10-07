package pl.spotonslot.identity;

/** The owner changed the password in the settings: tell {@code email} in {@code locale}. */
public record PasswordChanged(String email, String locale) {
}
