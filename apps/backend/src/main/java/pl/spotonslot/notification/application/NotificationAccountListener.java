package pl.spotonslot.notification.application;

import lombok.RequiredArgsConstructor;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import pl.spotonslot.identity.AccountDeleted;

/**
 * A purged account's notifications and settings are deleted. While an account waits for deletion nothing new reaches
 * it ({@code Accounts.deletionPending} is checked when notifications are made); a restore resumes that.
 */
@Component
@RequiredArgsConstructor
class NotificationAccountListener {

    private final NotificationService notifications;

    @ApplicationModuleListener
    void on(AccountDeleted event) {
        notifications.deleteOf(event.userId());
    }
}
