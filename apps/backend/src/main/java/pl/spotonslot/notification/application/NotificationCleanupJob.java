package pl.spotonslot.notification.application;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Deletes notifications older than 90 days, nightly. */
@Slf4j
@Component
@RequiredArgsConstructor
class NotificationCleanupJob {

    private final NotificationService notifications;

    @Scheduled(cron = "0 45 3 * * *")
    void deleteOld() {
        var deleted = notifications.deleteOld();
        if (deleted > 0) {
            log.info("Deleted {} old notifications", deleted);
        }
    }
}
