package pl.spotonslot.venue.application;

import lombok.RequiredArgsConstructor;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import pl.spotonslot.identity.AccountDeleted;
import pl.spotonslot.identity.AccountDeletionRequested;

/** Hides the venues of an account waiting for deletion and removes the account from teams once it is purged. */
@Component
@RequiredArgsConstructor
class VenueAccountListener {

    private final VenueAccountService accounts;

    @ApplicationModuleListener
    void on(AccountDeletionRequested event) {
        accounts.hideSoleVenues(event.userId());
    }

    @ApplicationModuleListener
    void on(AccountDeleted event) {
        accounts.removePurgedAccount(event.userId());
    }
}
