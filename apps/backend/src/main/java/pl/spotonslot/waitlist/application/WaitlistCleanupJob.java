package pl.spotonslot.waitlist.application;

import java.time.Clock;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Daily removal of sign-ups that were never confirmed. */
@Slf4j
@Component
@RequiredArgsConstructor
class WaitlistCleanupJob {

    private final WaitlistService waitlistService;
    private final Clock clock;

    @Scheduled(cron = "0 0 3 * * *")
    void deleteStalePending() {
        var deleted = waitlistService.deleteStalePending(clock.instant());
        log.info("Deleted {} stale pending waitlist sign-ups", deleted);
    }
}
