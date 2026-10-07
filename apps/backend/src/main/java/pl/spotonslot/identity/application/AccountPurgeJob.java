package pl.spotonslot.identity.application;

import java.time.Clock;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Daily purge of accounts whose deletion grace period is over ({@code spotonslot.identity.purge-cron}). */
@Slf4j
@Component
@RequiredArgsConstructor
class AccountPurgeJob {

    private final AccountPurgeService purge;
    private final Clock clock;

    @Scheduled(cron = "${spotonslot.identity.purge-cron:0 30 3 * * *}")
    void purgeDue() {
        var purged = purge.purgeDue(clock.instant());
        if (purged > 0) {
            log.info("Purged {} deleted accounts", purged);
        }
    }
}
