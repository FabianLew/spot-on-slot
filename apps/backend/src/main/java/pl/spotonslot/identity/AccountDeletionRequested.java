package pl.spotonslot.identity;

import java.time.Instant;
import java.util.UUID;

/**
 * The owner asked to delete the account. Modules hide what others see of it (unpublish, close, cancel); the data
 * stays until {@link AccountDeleted}, so a restore within the grace period finds it. {@code deletionAt} is when the
 * account will be purged; {@code email} and {@code locale} are for the confirmation e-mail.
 */
public record AccountDeletionRequested(UUID userId, String email, String locale, Instant deletionAt) {
}
