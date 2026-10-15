package pl.spotonslot.moderation.api;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import pl.spotonslot.identity.AccountInfo;
import pl.spotonslot.identity.PersonalDataSection;
import pl.spotonslot.moderation.api.ModerationDtos.SentReport;
import pl.spotonslot.moderation.application.ReportService;

/** The reports the person sent (not what others reported about them, nor what admins decided). */
@Component
@RequiredArgsConstructor
class ReportPersonalData implements PersonalDataSection {

    private final ReportService reports;

    @Override
    public String key() {
        return "reports";
    }

    @Override
    public Object export(AccountInfo account) {
        return reports.sentBy(account.id()).stream().map(SentReport::of).toList();
    }
}
