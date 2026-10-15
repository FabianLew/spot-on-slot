package pl.spotonslot.identity;

/** Send {@code email} the link (raw {@code token}, only its hash is stored) that sets the new admin's password. */
public record AdminInvited(String email, String locale, String token) {
}
