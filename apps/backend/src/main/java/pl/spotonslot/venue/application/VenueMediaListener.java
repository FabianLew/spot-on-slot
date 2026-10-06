package pl.spotonslot.venue.application;

import lombok.RequiredArgsConstructor;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import pl.spotonslot.media.MediaDeleted;

/** Keeps venues from pointing at deleted images. */
@Component
@RequiredArgsConstructor
class VenueMediaListener {

    private final VenueService venues;

    @ApplicationModuleListener
    void on(MediaDeleted event) {
        venues.forgetMedia(event.mediaId());
    }
}
