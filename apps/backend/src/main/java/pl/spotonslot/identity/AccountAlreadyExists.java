package pl.spotonslot.identity;

/**
 * Someone tried to register an address that already has an account. The response does not reveal it, so the owner
 * gets an e-mail pointing to login and password reset instead.
 */
public record AccountAlreadyExists(String email, String locale) {
}
