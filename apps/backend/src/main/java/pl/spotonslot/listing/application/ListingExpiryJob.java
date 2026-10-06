package pl.spotonslot.listing.application;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Stores the expiry of listings whose time has started; reads already treat them as expired before this runs. */
@Slf4j
@Component
@RequiredArgsConstructor
class ListingExpiryJob {

    private final ListingService listingService;

    @Scheduled(cron = "0 */15 * * * *")
    void expireStarted() {
        var expired = listingService.expireStarted();
        if (expired > 0) {
            log.info("Expired {} started listings", expired);
        }
    }
}
