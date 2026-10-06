package pl.spotonslot.artist.application;

import lombok.RequiredArgsConstructor;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import pl.spotonslot.media.MediaDeleted;

/** Keeps profiles from pointing at deleted images. */
@Component
@RequiredArgsConstructor
class MediaDeletedListener {

    private final ArtistProfileService profiles;

    @ApplicationModuleListener
    void on(MediaDeleted event) {
        profiles.forgetMedia(event.mediaId());
    }
}
