package pl.spotonslot.moderation.application;

import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import pl.spotonslot.identity.AccountDeleted;
import pl.spotonslot.moderation.infrastructure.ModerationActionRepository;
import pl.spotonslot.venue.VenuesDeletedWithAccount;

/** A purged account leaves reports and the history as "Usunięte konto"; both stay for the admins. */
@Component
@RequiredArgsConstructor
class ModerationAccountListener {

    private final ReportService reports;
    private final ModerationActionRepository actions;

    @ApplicationModuleListener
    void on(AccountDeleted event) {
        reports.forget(event.userId());
        actions.forgetSubject(event.userId(), ReportService.DELETED_NAME);
        actions.forgetAdmin(event.userId(), ReportService.DELETED_NAME);
    }

    @ApplicationModuleListener
    void on(VenuesDeletedWithAccount event) {
        reports.forgetVenues(event.venueIds());
        if (!event.venueIds().isEmpty()) {
            actions.forgetVenues(List.copyOf(event.venueIds()), ReportService.DELETED_NAME);
        }
    }
}
