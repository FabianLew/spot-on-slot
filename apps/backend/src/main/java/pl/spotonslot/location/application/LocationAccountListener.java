package pl.spotonslot.location.application;

import lombok.RequiredArgsConstructor;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import pl.spotonslot.identity.AccountDeleted;

/** A purged account's location is deleted. */
@Component
@RequiredArgsConstructor
class LocationAccountListener {

    private final LocationService locations;

    @ApplicationModuleListener
    void on(AccountDeleted event) {
        locations.deleteForUser(event.userId());
    }
}
