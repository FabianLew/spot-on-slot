package pl.spotonslot.artist.application;

import lombok.RequiredArgsConstructor;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import pl.spotonslot.identity.AccountDeleted;
import pl.spotonslot.identity.AccountDeletionRequested;

/**
 * An account waiting for deletion loses its public profile (a restore leaves it unpublished, publishing again is one
 * click); a purged account loses the profile with its genres, tags, links and photo list.
 */
@Component
@RequiredArgsConstructor
class ArtistAccountListener {

    private final ArtistProfileService profiles;

    @ApplicationModuleListener
    void on(AccountDeletionRequested event) {
        profiles.hide(event.userId());
    }

    @ApplicationModuleListener
    void on(AccountDeleted event) {
        profiles.deleteOf(event.userId());
    }
}
