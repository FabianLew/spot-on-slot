package pl.spotonslot.identity.application;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import pl.spotonslot.identity.IdentityProperties;
import pl.spotonslot.identity.domain.AccountStatus;
import pl.spotonslot.identity.domain.IdentityErrors;
import pl.spotonslot.identity.domain.RefreshToken;
import pl.spotonslot.identity.domain.SecretToken;
import pl.spotonslot.identity.domain.UserAccount;
import pl.spotonslot.identity.infrastructure.AccessTokenIssuer;
import pl.spotonslot.identity.infrastructure.RefreshTokenRepository;
import pl.spotonslot.identity.infrastructure.UserAccountRepository;

/** Login, refresh token rotation and logout. */
@Slf4j
@Service
@RequiredArgsConstructor
public class SessionService {

    private final UserAccountRepository accounts;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder passwordEncoder;
    private final AccessTokenIssuer accessTokens;
    private final IdentityProperties properties;
    private final TransactionTemplate transaction;
    private final Clock clock;

    /** Hash of a random password, checked for unknown e-mails so both failures take about as long. */
    private volatile String dummyHash;

    @Transactional
    public SessionTokens login(String email, String password) {
        var account = accounts.findByEmail(Emails.normalize(email)).orElse(null);
        if (account == null) {
            passwordEncoder.matches(password, dummyHash());
            throw new IdentityErrors.InvalidCredentials();
        }
        if (!passwordEncoder.matches(password, account.getPasswordHash())) {
            throw new IdentityErrors.InvalidCredentials();
        }
        // Status is checked only after the password, so these answers reveal nothing to someone without it.
        switch (account.getStatus()) {
            case PENDING_VERIFICATION -> throw new IdentityErrors.EmailNotVerified();
            case BLOCKED -> throw new IdentityErrors.AccountBlocked();
            case ACTIVE -> { }
        }
        var now = clock.instant();
        return issue(account, UUID.randomUUID(), now);
    }

    /**
     * Exchanges a refresh token for a new pair. A token that was already rotated is a sign of theft: the whole family
     * is revoked (committed even though the call fails) and the client has to log in again.
     */
    public SessionTokens refresh(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new IdentityErrors.RefreshInvalid();
        }
        var outcome = transaction.execute(status -> refreshInTransaction(rawToken));
        if (outcome == null) {
            throw new IdentityErrors.RefreshInvalid();
        }
        return outcome;
    }

    private SessionTokens refreshInTransaction(String rawToken) {
        var now = clock.instant();
        var token = refreshTokens.findByTokenHash(SecretToken.hash(rawToken)).orElse(null);
        if (token == null) {
            return null;
        }
        if (token.isRotated() && token.getRevokedAt() == null) {
            log.warn("Rotated refresh token presented again; revoking its family");
            refreshTokens.revokeFamily(token.getFamilyId(), now);
            return null;
        }
        if (!token.isActive(now)) {
            return null;
        }
        var account = accounts.findById(token.getUserId()).orElse(null);
        if (account == null || account.getStatus() != AccountStatus.ACTIVE) {
            refreshTokens.revokeFamily(token.getFamilyId(), now);
            return null;
        }
        token.rotate(now);
        return issue(account, token.getFamilyId(), now);
    }

    /** Revokes the session the refresh token belongs to; unknown or missing tokens are ignored. */
    @Transactional
    public void logout(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }
        refreshTokens.findByTokenHash(SecretToken.hash(rawToken))
                .ifPresent(token -> refreshTokens.revokeFamily(token.getFamilyId(), clock.instant()));
    }

    /** Ends every session of the account, e.g. after a password reset. */
    @Transactional
    public void revokeAll(UUID userId) {
        refreshTokens.revokeAllForUser(userId, clock.instant());
    }

    private SessionTokens issue(UserAccount account, UUID familyId, Instant now) {
        var raw = SecretToken.generate();
        refreshTokens.save(RefreshToken.issue(account.getId(), familyId, SecretToken.hash(raw),
                now.plus(properties.refreshTokenTtl())));
        return new SessionTokens(accessTokens.issue(account, now), accessTokens.ttl(), raw,
                properties.refreshTokenTtl());
    }

    private String dummyHash() {
        if (dummyHash == null) {
            dummyHash = passwordEncoder.encode(SecretToken.generate());
        }
        return dummyHash;
    }
}
