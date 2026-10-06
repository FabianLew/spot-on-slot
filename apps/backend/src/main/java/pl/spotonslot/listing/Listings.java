package pl.spotonslot.listing;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import pl.spotonslot.listing.application.ListingService;

/** The module's facade for other modules (search, booking, notifications). */
@Service
@RequiredArgsConstructor
public class Listings {

    private final ListingService listings;

    /** A listing that is active now (not closed, expired, filled or started). */
    public Optional<ActiveListing> findActive(UUID listingId) {
        return listings.findActive(listingId);
    }

    /** Those of the listings that are active now. */
    public Set<UUID> activeAmong(Collection<UUID> listingIds) {
        return listings.activeAmong(listingIds);
    }

    /**
     * Active listings within {@code radiusKm} of the centre, nearest first; authors may be unpublished, so callers
     * check them.
     *
     * @throws IllegalArgumentException for a radius outside 1–500 km or a limit outside 1–1000
     */
    public List<NearbyListing> findActiveWithin(ListingSearch search) {
        if (!(search.radiusKm() >= 1 && search.radiusKm() <= 500)) {
            throw new IllegalArgumentException("Radius must be between 1 and 500 km: " + search.radiusKm());
        }
        if (search.limit() < 1 || search.limit() > 1000) {
            throw new IllegalArgumentException("Limit must be between 1 and 1000: " + search.limit());
        }
        return listings.findActiveWithin(search);
    }

    /** Closes an active listing as taken by a booking; fails with {@code LISTING_NOT_ACTIVE}. */
    public void markFilled(UUID listingId) {
        listings.markFilled(listingId);
    }
}
