package pl.spotonslot.identity.application;

import java.time.Clock;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.spotonslot.identity.IdentityProperties;
import pl.spotonslot.identity.PasswordResetRequested;
import pl.spotonslot.identity.domain.AccountStatus;
import pl.spotonslot.identity.domain.IdentityErrors;
import pl.spotonslot.identity.domain.OneTimeToken;
import pl.spotonslot.shared.security.SecretToken;
import pl.spotonslot.identity.domain.TokenType;
import pl.spotonslot.identity.infrastructure.OneTimeTokenRepository;
import pl.spotonslot.identity.infrastructure.UserAccountRepository;

/** "Forgot password": a one-hour link by e-mail, then a new password that ends every existing session. */
@Service
@RequiredArgsConstructor
public class PasswordResetService {

    private final UserAccountRepository accounts;
    private final OneTimeTokenRepository tokens;
    private final PasswordEncoder passwordEncoder;
    private final AccountService accountService;
    private final SessionService sessions;
    private final ApplicationEventPublisher events;
    private final IdentityProperties properties;
    private final Clock clock;

    /** Sends a reset link if the address has an account that is not blocked; silently does nothing otherwise. */
    @Transactional
    public void request(String email) {
        var now = clock.instant();
        accounts.findByEmail(Emails.normalize(email))
                .filter(account -> account.getStatus() != AccountStatus.BLOCKED)
                .filter(account -> accountService.canSend(account, TokenType.PASSWORD_RESET, now))
                .ifPresent(account -> {
                    var raw = SecretToken.generate();
                    tokens.save(OneTimeToken.issue(account.getId(), TokenType.PASSWORD_RESET, SecretToken.hash(raw),
                            now.plus(properties.resetTokenTtl())));
                    events.publishEvent(new PasswordResetRequested(account.getEmail(), account.getLocale(), raw));
                });
    }

    /**
     * Sets the new password. The link proves the address, so a still unverified account becomes active too.
     */
    @Transactional
    public void confirm(String rawToken, String newPassword) {
        var now = clock.instant();
        var token = tokens.findByTokenHashAndType(SecretToken.hash(rawToken), TokenType.PASSWORD_RESET)
                .filter(candidate -> candidate.isUsable(now))
                .orElseThrow(IdentityErrors.TokenInvalid::new);
        var account = accounts.findById(token.getUserId()).orElseThrow(IdentityErrors.TokenInvalid::new);
        if (account.getStatus() == AccountStatus.BLOCKED) {
            throw new IdentityErrors.TokenInvalid();
        }
        if (account.getEmail().equals(Emails.normalize(newPassword))) {
            throw new IdentityErrors.PasswordEqualsEmail();
        }
        token.use(now);
        account.changePassword(passwordEncoder.encode(newPassword));
        account.verifyEmail(now);
        sessions.revokeAll(account.getId());
    }
}
