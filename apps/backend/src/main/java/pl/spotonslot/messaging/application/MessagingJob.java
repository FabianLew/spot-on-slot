package pl.spotonslot.messaging.application;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Looks for messages that have waited unread long enough for an e-mail, every minute. */
@Slf4j
@Component
@RequiredArgsConstructor
class MessagingJob {

    private final UnreadReminders reminders;

    @Scheduled(cron = "${spotonslot.messaging.reminder-cron:0 * * * * *}")
    void remind() {
        var sent = reminders.run();
        if (sent > 0) {
            log.info("Reminded {} people of unread messages", sent);
        }
    }
}
