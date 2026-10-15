package pl.spotonslot.identity;

import java.util.UUID;

/**
 * An admin blocked the account: it is signed out everywhere and cannot sign in. Modules hide what others see of it
 * (unpublish, close, cancel) as for {@link AccountDeletionRequested}; {@code email}, {@code locale} and
 * {@code reason} are for the e-mail that tells the person.
 */
public record AccountBlocked(UUID userId, String email, String locale, String reason) {
}
