package pl.spotonslot.media.application;

import java.time.Clock;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Daily removal of uploads that were started but never completed. */
@Slf4j
@Component
@RequiredArgsConstructor
class MediaCleanupJob {

    private final MediaService mediaService;
    private final Clock clock;

    @Scheduled(cron = "0 30 3 * * *")
    void deleteStaleUploads() {
        var deleted = mediaService.deleteStaleUploads(clock.instant());
        log.info("Deleted {} stale media uploads", deleted);
    }
}
