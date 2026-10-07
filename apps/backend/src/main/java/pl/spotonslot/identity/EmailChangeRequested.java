package pl.spotonslot.identity;

/**
 * The owner asked to move the account to {@code newEmail}: send the confirmation {@code token} (raw value, only its
 * hash is stored) there and a notice to {@code currentEmail}. {@code taken} = another account already uses
 * {@code newEmail}: it gets a notice that its account exists instead of a link, so the answer reveals nothing.
 */
public record EmailChangeRequested(String currentEmail, String newEmail, String locale, String token, boolean taken) {
}
