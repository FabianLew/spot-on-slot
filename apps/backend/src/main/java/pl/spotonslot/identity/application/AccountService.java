package pl.spotonslot.identity.application;

import java.time.Clock;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import pl.spotonslot.identity.AccountAlreadyExists;
import pl.spotonslot.identity.EmailVerificationRequested;
import pl.spotonslot.identity.IdentityProperties;
import pl.spotonslot.identity.UserRegistered;
import pl.spotonslot.identity.domain.AccountStatus;
import pl.spotonslot.identity.domain.IdentityErrors;
import pl.spotonslot.identity.domain.OneTimeToken;
import pl.spotonslot.shared.security.SecretToken;
import pl.spotonslot.identity.domain.TokenType;
import pl.spotonslot.identity.domain.UserAccount;
import pl.spotonslot.identity.infrastructure.OneTimeTokenRepository;
import pl.spotonslot.identity.infrastructure.UserAccountRepository;

/**
 * Registration and e-mail verification. Registering and resending look the same to the caller whether or not the
 * address has an account, so the endpoints do not reveal which addresses are registered.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AccountService {

    private final UserAccountRepository accounts;
    private final OneTimeTokenRepository tokens;
    private final PasswordEncoder passwordEncoder;
    private final ApplicationEventPublisher events;
    private final IdentityProperties properties;
    private final TransactionTemplate transaction;
    private final Clock clock;

    public void register(RegisterCommand command) {
        var email = Emails.normalize(command.email());
        if (email.equals(Emails.normalize(command.password()))) {
            throw new IdentityErrors.PasswordEqualsEmail();
        }
        // Programmatic transaction: a unique-key violation from a parallel registration marks the transaction
        // rollback-only, so it can only be swallowed outside of it. The other request already did the work.
        try {
            transaction.executeWithoutResult(status -> registerInTransaction(email, command));
        } catch (DataIntegrityViolationException e) {
            log.warn("Parallel registration for the same e-mail ignored ({})",
                    e.getMostSpecificCause().getClass().getSimpleName());
        }
    }

    private void registerInTransaction(String email, RegisterCommand command) {
        var now = clock.instant();
        var existing = accounts.findByEmail(email);
        if (existing.isEmpty()) {
            var account = accounts.saveAndFlush(UserAccount.register(email, passwordEncoder.encode(command.password()),
                    command.role(), command.locale(), now));
            events.publishEvent(new UserRegistered(account.getId(), account.getRole()));
            sendVerification(account, now);
            return;
        }
        var account = existing.get();
        if (account.isPendingVerification()) {
            if (canSend(account, TokenType.EMAIL_VERIFICATION, now)) {
                sendVerification(account, now);
            }
            return;
        }
        events.publishEvent(new AccountAlreadyExists(email, command.locale()));
    }

    /**
     * Activates the account the link was issued for. Opening the same link again after it worked is not an error.
     */
    @Transactional
    public void verifyEmail(String rawToken) {
        var token = tokens.findByTokenHashAndType(SecretToken.hash(rawToken), TokenType.EMAIL_VERIFICATION)
                .orElseThrow(IdentityErrors.TokenInvalid::new);
        var account = accounts.findById(token.getUserId()).orElseThrow(IdentityErrors.TokenInvalid::new);
        var now = clock.instant();
        if (token.getUsedAt() != null && account.getEmailVerifiedAt() != null) {
            return;
        }
        if (!token.isUsable(now)) {
            throw new IdentityErrors.TokenInvalid();
        }
        token.use(now);
        account.verifyEmail(now);
    }

    /** Sends a new verification link to a pending account; silently does nothing otherwise. */
    @Transactional
    public void resendVerification(String email) {
        var now = clock.instant();
        accounts.findByEmail(Emails.normalize(email))
                .filter(UserAccount::isPendingVerification)
                .filter(account -> canSend(account, TokenType.EMAIL_VERIFICATION, now))
                .ifPresent(account -> sendVerification(account, now));
    }

    /** Deletes accounts still unverified after the pending retention; returns their count. */
    @Transactional
    public int deleteStalePending(Instant now) {
        return accounts.deleteByStatusAndCreatedAtBefore(AccountStatus.PENDING_VERIFICATION,
                now.minus(properties.pendingRetention()));
    }

    private void sendVerification(UserAccount account, Instant now) {
        var raw = SecretToken.generate();
        tokens.save(OneTimeToken.issue(account.getId(), TokenType.EMAIL_VERIFICATION, SecretToken.hash(raw),
                now.plus(properties.verificationTokenTtl())));
        events.publishEvent(new EmailVerificationRequested(account.getEmail(), account.getLocale(), raw));
    }

    /** Whether the last e-mail of this type went out at least the resend interval ago. */
    boolean canSend(UserAccount account, TokenType type, Instant now) {
        return tokens.findByUserIdAndTypeOrderByCreatedAtDesc(account.getId(), type).stream()
                .findFirst()
                .map(last -> !now.isBefore(last.getCreatedAt().plus(properties.resendInterval())))
                .orElse(true);
    }
}
