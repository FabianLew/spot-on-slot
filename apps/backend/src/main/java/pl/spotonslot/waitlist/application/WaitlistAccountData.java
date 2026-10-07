package pl.spotonslot.waitlist.application;

import java.time.Instant;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import pl.spotonslot.identity.AccountDeleted;
import pl.spotonslot.identity.AccountInfo;
import pl.spotonslot.identity.PersonalDataSection;
import pl.spotonslot.waitlist.domain.WaitlistRole;
import pl.spotonslot.waitlist.infrastructure.WaitlistSignupRepository;

/**
 * The waitlist sign-up with the account's e-mail address: part of the data export, and deleted with the account.
 */
@Component
@RequiredArgsConstructor
class WaitlistAccountData implements PersonalDataSection {

    record SignupExport(String email, WaitlistRole role, String city, String locale, String status,
            Instant signedUpAt, Instant consentAt, Instant confirmedAt) {
    }

    private final WaitlistSignupRepository signups;

    @Override
    public String key() {
        return "waitlist";
    }

    @Override
    @Transactional(readOnly = true)
    public Object export(AccountInfo account) {
        return signups.findByEmail(normalize(account.email()))
                .map(signup -> new SignupExport(signup.getEmail(), signup.getRole(), signup.getCity(),
                        signup.getLocale(), signup.getStatus().name(), signup.getCreatedAt(), signup.getConsentAt(),
                        signup.getConfirmedAt()))
                .orElse(null);
    }

    @ApplicationModuleListener
    void on(AccountDeleted event) {
        if (event.email() != null) {
            signups.findByEmail(normalize(event.email())).ifPresent(signups::delete);
        }
    }

    private static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
