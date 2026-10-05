package pl.spotonslot.waitlist.application;

import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import pl.spotonslot.waitlist.WaitlistConfirmationRequested;
import pl.spotonslot.waitlist.WaitlistProperties;
import pl.spotonslot.waitlist.domain.ConfirmationToken;
import pl.spotonslot.waitlist.domain.WaitlistSignup;
import pl.spotonslot.waitlist.domain.WaitlistStatus;
import pl.spotonslot.waitlist.infrastructure.WaitlistSignupRepository;

/**
 * Waitlist sign-ups. Every outcome looks the same to the caller, so the endpoint does not reveal whether an
 * address is already on the list.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WaitlistService {

    private final WaitlistSignupRepository repository;
    private final ApplicationEventPublisher events;
    private final WaitlistProperties properties;
    private final TransactionTemplate transaction;
    private final Clock clock;

    public void signUp(SignupCommand command) {
        if (command.website() != null && !command.website().isBlank()) {
            log.debug("Waitlist sign-up with a filled honeypot ignored");
            return;
        }
        // Programmatic transaction: a failed insert marks the transaction rollback-only, so the unique-constraint
        // violation of a parallel sign-up can only be swallowed outside of it.
        try {
            transaction.executeWithoutResult(status -> register(command));
        } catch (DataIntegrityViolationException e) {
            log.debug("Parallel waitlist sign-up for the same e-mail ignored");
        }
    }

    private void register(SignupCommand command) {
        var email = command.email().trim().toLowerCase(Locale.ROOT);
        var now = clock.instant();
        var existing = repository.findByEmail(email);
        if (existing.isEmpty()) {
            var token = ConfirmationToken.generate();
            repository.saveAndFlush(WaitlistSignup.pending(email, command.role(), command.city(), command.locale(),
                    ConfirmationToken.hash(token), expiresAt(now), now));
            requestConfirmation(email, command.locale(), token);
            return;
        }
        var signup = existing.get();
        if (signup.getStatus() == WaitlistStatus.CONFIRMED) {
            return;
        }
        signup.refresh(command.role(), command.city(), command.locale());
        if (signup.canResend(now, properties.resendInterval())) {
            var token = ConfirmationToken.generate();
            signup.issueToken(ConfirmationToken.hash(token), expiresAt(now), now);
            requestConfirmation(email, command.locale(), token);
        }
    }

    private Instant expiresAt(Instant now) {
        return now.plus(properties.tokenTtl());
    }

    private void requestConfirmation(String email, String locale, String token) {
        events.publishEvent(new WaitlistConfirmationRequested(email, locale, token));
    }
}
