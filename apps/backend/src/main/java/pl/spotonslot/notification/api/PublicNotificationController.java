package pl.spotonslot.notification.api;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pl.spotonslot.notification.api.NotificationDtos.UnsubscribeRequest;
import pl.spotonslot.notification.application.NotificationService;

/** The unsubscribe link from alert e-mails, without signing in (under {@code /api/v1/public/**}). */
@RestController
@RequestMapping("/api/v1/public/notifications")
@RequiredArgsConstructor
class PublicNotificationController {

    private final NotificationService notifications;

    /** Switches e-mails about listings nearby off; fails with {@code NOTIFICATION_UNSUBSCRIBE_INVALID}. */
    @PostMapping("/unsubscribe")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void unsubscribeNotificationEmails(@Valid @RequestBody UnsubscribeRequest request) {
        notifications.unsubscribe(request.token());
    }
}
