package pl.spotonslot.listing;

import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import pl.spotonslot.listing.application.ListingService;

/** The module's facade for other modules (search, booking). */
@Service
@RequiredArgsConstructor
public class Listings {

    private final ListingService listings;

    /** A listing that is active now (not closed, expired, filled or started). */
    public Optional<ActiveListing> findActive(UUID listingId) {
        return listings.findActive(listingId);
    }

    /** Closes an active listing as taken by a booking; fails with {@code LISTING_NOT_ACTIVE}. */
    public void markFilled(UUID listingId) {
        listings.markFilled(listingId);
    }
}
