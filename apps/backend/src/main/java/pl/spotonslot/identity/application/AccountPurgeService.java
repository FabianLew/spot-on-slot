package pl.spotonslot.identity.application;

import java.time.Instant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import pl.spotonslot.identity.AccountDeleted;
import pl.spotonslot.identity.IdentityProperties;
import pl.spotonslot.identity.infrastructure.UserAccountRepository;

/**
 * Purges accounts whose deletion grace period is over: each in its own transaction, which deletes the account (its
 * tokens and sessions cascade) and publishes {@link AccountDeleted} for the modules to erase their data.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AccountPurgeService {

    private final UserAccountRepository accounts;
    private final ApplicationEventPublisher events;
    private final IdentityProperties properties;
    private final TransactionTemplate transaction;

    /** Returns how many accounts were purged. */
    public int purgeDue(Instant now) {
        var due = accounts.findDeletionDue(now.minus(properties.deletionGrace()));
        var purged = 0;
        for (var candidate : due) {
            var done = Boolean.TRUE.equals(transaction.execute(status -> accounts.findById(candidate.getId())
                    // Restored meanwhile: keep it.
                    .filter(account -> account.isDeletionPending())
                    .map(account -> {
                        events.publishEvent(new AccountDeleted(account.getId(), account.getEmail(),
                                account.getLocale()));
                        accounts.delete(account);
                        return true;
                    })
                    .orElse(false)));
            if (done) {
                purged++;
                log.info("Account {} purged", candidate.getId());
            }
        }
        return purged;
    }
}
