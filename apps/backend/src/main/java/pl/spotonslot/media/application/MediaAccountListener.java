package pl.spotonslot.media.application;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import pl.spotonslot.identity.AccountDeleted;

/** A purged account's images leave storage. */
@Slf4j
@Component
@RequiredArgsConstructor
class MediaAccountListener {

    private final MediaService media;

    @ApplicationModuleListener
    void on(AccountDeleted event) {
        var deleted = media.deleteAllOf(event.userId());
        log.info("Deleted {} images of a purged account", deleted);
    }
}
