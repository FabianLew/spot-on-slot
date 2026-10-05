package pl.spotonslot.identity.application;

import java.time.Clock;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Daily removal of accounts whose e-mail address was never verified. */
@Slf4j
@Component
@RequiredArgsConstructor
class IdentityCleanupJob {

    private final AccountService accountService;
    private final Clock clock;

    @Scheduled(cron = "0 15 3 * * *")
    void deleteStalePending() {
        var deleted = accountService.deleteStalePending(clock.instant());
        log.info("Deleted {} stale unverified accounts", deleted);
    }
}
