package pl.spotonslot.booking.application;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Stores expired requests and completed bookings; reads already show those statuses before this runs. */
@Slf4j
@Component
@RequiredArgsConstructor
class BookingJob {

    private final BookingService bookingService;

    @Scheduled(cron = "0 */15 * * * *")
    void storeTimedOut() {
        var stored = bookingService.storeTimedOut();
        if (stored > 0) {
            log.info("Stored {} expired or completed bookings", stored);
        }
    }
}
