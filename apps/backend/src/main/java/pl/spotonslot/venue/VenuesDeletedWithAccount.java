package pl.spotonslot.venue;

import java.util.Set;
import java.util.UUID;

/**
 * An account was purged and {@code venueIds} went with it, since nobody else was in their teams. Modules that copied
 * the venues' names (bookings, conversations) anonymize them; listings of the venues are deleted.
 */
public record VenuesDeletedWithAccount(UUID userId, Set<UUID> venueIds) {
}
