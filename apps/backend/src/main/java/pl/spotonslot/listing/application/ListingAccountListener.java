package pl.spotonslot.listing.application;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import pl.spotonslot.identity.AccountDeleted;
import pl.spotonslot.identity.AccountDeletionRequested;
import pl.spotonslot.venue.Venues;
import pl.spotonslot.venue.VenuesDeletedWithAccount;

/**
 * Closes the listings of an account waiting for deletion (theirs and those of venues only they are in) and deletes
 * them once the account is purged, the listings of venues deleted with it included.
 */
@Slf4j
@Component
@RequiredArgsConstructor
class ListingAccountListener {

    private final ListingService listings;
    private final Venues venues;

    @ApplicationModuleListener
    void on(AccountDeletionRequested event) {
        var closed = listings.closeOfDeletedAccount(event.userId(), venues.soleMemberVenues(event.userId()));
        log.info("Closed {} listings of an account waiting for deletion", closed);
    }

    @ApplicationModuleListener
    void on(AccountDeleted event) {
        listings.deleteOfPerson(event.userId());
    }

    @ApplicationModuleListener
    void on(VenuesDeletedWithAccount event) {
        listings.deleteOfVenues(event.venueIds());
    }
}
