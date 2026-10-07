package pl.spotonslot.notification.api;

import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;
import pl.spotonslot.identity.AccountInfo;
import pl.spotonslot.identity.PersonalDataSection;
import pl.spotonslot.notification.api.NotificationDtos.NotificationResponse;
import pl.spotonslot.notification.api.NotificationDtos.PreferencesResponse;
import pl.spotonslot.notification.application.NotificationService;

/** The notifications kept for the person (90 days) and their notification settings. */
@Component
@RequiredArgsConstructor
class NotificationPersonalData implements PersonalDataSection {

    record NotificationsExport(List<NotificationResponse> notifications, PreferencesResponse preferences) {
    }

    private final NotificationService notifications;

    @Override
    public String key() {
        return "notifications";
    }

    @Override
    public Object export(AccountInfo account) {
        var all = notifications.list(account.id(), PageRequest.of(0, Integer.MAX_VALUE)).getContent();
        return new NotificationsExport(all.stream().map(NotificationResponse::of).toList(),
                PreferencesResponse.of(notifications.settings(account.id())));
    }
}
