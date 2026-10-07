package pl.spotonslot.identity;

import java.util.UUID;

/**
 * The grace period ended and the account is gone: every module deletes or anonymizes what it holds about
 * {@code userId} (and, by {@code email}, the waitlist). Published once, in the transaction that deletes the account;
 * a failed listener stays in the event registry and is retried, so no module's purge is lost.
 */
public record AccountDeleted(UUID userId, String email, String locale) {
}
