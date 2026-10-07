package pl.spotonslot.identity.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import pl.spotonslot.shared.persistence.BaseEntity;

/** A single-use token sent by e-mail (verification, password reset or a new address to confirm). */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "identity_token")
public class OneTimeToken extends BaseEntity {

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 24, updatable = false)
    private TokenType type;

    @Column(name = "token_hash", nullable = false, length = 64, updatable = false)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false, updatable = false)
    private Instant expiresAt;

    @Column(name = "used_at")
    private Instant usedAt;

    /** The address an {@link TokenType#EMAIL_CHANGE} token moves the account to. */
    @Column(name = "target_email", length = 254, updatable = false)
    private String targetEmail;

    public static OneTimeToken issue(UUID userId, TokenType type, String tokenHash, Instant expiresAt) {
        var token = new OneTimeToken();
        token.userId = userId;
        token.type = type;
        token.tokenHash = tokenHash;
        token.expiresAt = expiresAt;
        return token;
    }

    public static OneTimeToken emailChange(UUID userId, String tokenHash, String targetEmail, Instant expiresAt) {
        var token = issue(userId, TokenType.EMAIL_CHANGE, tokenHash, expiresAt);
        token.targetEmail = targetEmail;
        return token;
    }

    /** Unused and not expired at {@code now}. */
    public boolean isUsable(Instant now) {
        return usedAt == null && now.isBefore(expiresAt);
    }

    public void use(Instant now) {
        usedAt = now;
    }
}
