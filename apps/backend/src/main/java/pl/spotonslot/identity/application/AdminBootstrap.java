package pl.spotonslot.identity.application;

import java.time.Clock;
import java.time.temporal.ChronoUnit;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import pl.spotonslot.identity.AdminProperties;
import pl.spotonslot.identity.TermsProperties;
import pl.spotonslot.identity.domain.UserAccount;
import pl.spotonslot.identity.infrastructure.UserAccountRepository;

/**
 * Creates the configured first admin account at startup if its address has no account yet. An existing account is
 * left as it is (its password is never reset from the configuration), so the variables can stay set.
 */
@Slf4j
@Component
@RequiredArgsConstructor
class AdminBootstrap implements ApplicationRunner {

    private final AdminProperties admin;
    private final UserAccountRepository accounts;
    private final PasswordEncoder passwordEncoder;
    private final TermsProperties terms;
    private final TransactionTemplate transaction;
    private final Clock clock;

    @Override
    public void run(ApplicationArguments args) {
        if (admin.email() == null || admin.email().isBlank() || admin.password() == null || admin.password().isBlank()) {
            return;
        }
        var email = Emails.normalize(admin.email());
        try {
            transaction.executeWithoutResult(status -> {
                if (accounts.findByEmail(email).isEmpty()) {
                    accounts.save(UserAccount.bootstrapAdmin(email, passwordEncoder.encode(admin.password()),
                            terms.version(), clock.instant().truncatedTo(ChronoUnit.MICROS)));
                    log.info("Created the first admin account {}", email);
                }
            });
        } catch (DataIntegrityViolationException e) {
            // Another instance created it at the same time.
            log.info("First admin account already created");
        }
    }
}
