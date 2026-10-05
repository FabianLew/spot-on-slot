package pl.spotonslot.waitlist.application;

import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import pl.spotonslot.waitlist.WaitlistConfirmationRequested;
import pl.spotonslot.waitlist.WaitlistProperties;
import pl.spotonslot.waitlist.domain.ConfirmationToken;
import pl.spotonslot.waitlist.domain.WaitlistSignup;
import pl.spotonslot.waitlist.domain.WaitlistStatus;
import pl.spotonslot.waitlist.domain.WaitlistTokenExpiredException;
import pl.spotonslot.waitlist.domain.WaitlistTokenInvalidException;
import pl.spotonslot.waitlist.infrastructure.WaitlistSignupRepository;

/**
 * Waitlist sign-ups, their confirmation and cleanup. Every sign-up outcome looks the same to the caller, so the
 * endpoint does not reveal whether an address is already on the list.
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
        // Programmatic transaction: a failed write marks the transaction rollback-only, so a conflict with a parallel
        // sign-up for the same e-mail can only be swallowed outside of it. Either way the other request already did
        // the work (inserted the row or sent the e-mail), so this one is a no-op.
        try {
            transaction.executeWithoutResult(status -> register(command));
        } catch (DataIntegrityViolationException e) {
            log.debug("Parallel waitlist sign-up for the same e-mail ignored");
        } catch (OptimisticLockingFailureException e) {
            log.debug("Parallel waitlist sign-up update for the same e-mail ignored");
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

    /**
     * Confirms the sign-up the token was issued for. A token that was already used for confirmation keeps working,
     * so opening the link twice is not an error.
     */
    @Transactional
    public void confirm(String token) {
        var signup = repository.findByTokenHash(ConfirmationToken.hash(token))
                .orElseThrow(WaitlistTokenInvalidException::new);
        if (signup.getStatus() == WaitlistStatus.CONFIRMED) {
            return;
        }
        var now = clock.instant();
        if (signup.getTokenExpiresAt().isBefore(now)) {
            throw new WaitlistTokenExpiredException();
        }
        signup.confirm(now);
    }

    /** Deletes pending sign-ups created more than the pending retention before {@code now}; returns their count. */
    @Transactional
    public int deleteStalePending(Instant now) {
        return repository.deleteByStatusAndCreatedAtBefore(WaitlistStatus.PENDING,
                now.minus(properties.pendingRetention()));
    }

    private Instant expiresAt(Instant now) {
        return now.plus(properties.tokenTtl());
    }

    private void requestConfirmation(String email, String locale, String token) {
        events.publishEvent(new WaitlistConfirmationRequested(email, locale, token));
    }
}
