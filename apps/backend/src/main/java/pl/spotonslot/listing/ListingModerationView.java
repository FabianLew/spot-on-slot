package pl.spotonslot.listing;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import pl.spotonslot.artist.Genre;

/**
 * A listing as moderation sees it, whatever its status. {@code artistId} is set for "I'm free" listings,
 * {@code venueId} for "Looking for an artist"; {@code status} is ACTIVE, CLOSED, EXPIRED or FILLED as of now; {@code moderationReason} once an admin closed it.
 */
public record ListingModerationView(UUID id, ListingKind kind, String status, UUID authorId, UUID artistId,
        UUID venueId, Instant startsAt, Instant endsAt, List<Genre> genres, String description, Long priceFrom,
        Long priceTo, String city, Instant closedAt, String moderationReason) {
}
