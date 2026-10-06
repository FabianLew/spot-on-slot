package pl.spotonslot.listing.application;

import lombok.RequiredArgsConstructor;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import pl.spotonslot.availability.AvailabilityChanged;

/** Expires "I'm free" listings whose time left the artist's calendar (booked, removed, a day skipped). */
@Component
@RequiredArgsConstructor
class AvailabilityListener {

    private final ListingService listings;

    @ApplicationModuleListener
    void on(AvailabilityChanged event) {
        listings.expireNotFree(event.artistId());
    }
}
