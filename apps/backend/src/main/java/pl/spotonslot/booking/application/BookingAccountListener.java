package pl.spotonslot.booking.application;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import pl.spotonslot.identity.AccountDeleted;
import pl.spotonslot.identity.AccountDeletionRequested;
import pl.spotonslot.venue.Venues;
import pl.spotonslot.venue.VenuesDeletedWithAccount;

/**
 * An account waiting for deletion withdraws, declines and cancels its open bookings (the other side is told as
 * usual); once purged, its bookings stay with the other side under "Usunięte konto", its messages erased.
 */
@Slf4j
@Component
@RequiredArgsConstructor
class BookingAccountListener {

    private final BookingService bookings;
    private final Venues venues;

    @ApplicationModuleListener
    void on(AccountDeletionRequested event) {
        var closed = bookings.closeForDeletedAccount(event.userId(), venues.soleMemberVenues(event.userId()));
        log.info("Closed {} bookings of an account waiting for deletion", closed);
    }

    @ApplicationModuleListener
    void on(AccountDeleted event) {
        bookings.anonymizeArtist(event.userId());
    }

    @ApplicationModuleListener
    void on(VenuesDeletedWithAccount event) {
        bookings.anonymizeVenues(event.venueIds());
    }
}
