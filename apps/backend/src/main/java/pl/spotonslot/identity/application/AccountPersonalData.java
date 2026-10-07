package pl.spotonslot.identity.application;

import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import pl.spotonslot.identity.AccountInfo;
import pl.spotonslot.identity.PersonalDataSection;
import pl.spotonslot.identity.Role;
import pl.spotonslot.identity.infrastructure.UserAccountRepository;

/** The account itself in the data export: never the password hash or tokens. */
@Component
@RequiredArgsConstructor
class AccountPersonalData implements PersonalDataSection {

    record AccountExport(String email, Role role, String locale, String status, Instant registeredAt,
            Instant emailVerifiedAt, Instant privacyNoticeAcceptedAt, Instant termsAcceptedAt, String termsVersion,
            Instant deletionRequestedAt) {
    }

    private final UserAccountRepository accounts;

    @Override
    public String key() {
        return AccountSettingsService.ACCOUNT_SECTION;
    }

    @Override
    @Transactional(readOnly = true)
    public Object export(AccountInfo account) {
        return accounts.findById(account.id()).map(found -> new AccountExport(found.getEmail(), found.getRole(),
                found.getLocale(), found.getStatus().name(), found.getCreatedAt(), found.getEmailVerifiedAt(),
                found.getPrivacyNoticeAcceptedAt(), found.getTermsAcceptedAt(), found.getTermsVersion(),
                found.getDeletionRequestedAt())).orElse(null);
    }
}
