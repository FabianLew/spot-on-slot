package pl.spotonslot.messaging.application;

import lombok.RequiredArgsConstructor;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import pl.spotonslot.identity.AccountDeleted;
import pl.spotonslot.venue.VenuesDeletedWithAccount;

/**
 * Conversations stay with the other side after an account is purged, with its name and messages erased. Nothing
 * happens at the deletion request: the account cannot use the API meanwhile, and its profile is unpublished.
 */
@Component
@RequiredArgsConstructor
class MessagingAccountListener {

    private final MessagingAccountService accounts;

    @ApplicationModuleListener
    void on(AccountDeleted event) {
        accounts.anonymizeAccount(event.userId());
    }

    @ApplicationModuleListener
    void on(VenuesDeletedWithAccount event) {
        accounts.anonymizeVenues(event.venueIds());
    }
}
