package pl.spotonslot.identity.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import pl.spotonslot.shared.persistence.BaseEntity;

/**
 * A refresh token. Using it rotates it (a new token in the same family replaces it); presenting an already rotated
 * token means it leaked, so the whole family is revoked.
 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "identity_refresh_token")
public class RefreshToken extends BaseEntity {

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "family_id", nullable = false, updatable = false)
    private UUID familyId;

    @Column(name = "token_hash", nullable = false, length = 64, updatable = false)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false, updatable = false)
    private Instant expiresAt;

    @Column(name = "rotated_at")
    private Instant rotatedAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    public static RefreshToken issue(UUID userId, UUID familyId, String tokenHash, Instant expiresAt) {
        var token = new RefreshToken();
        token.userId = userId;
        token.familyId = familyId;
        token.tokenHash = tokenHash;
        token.expiresAt = expiresAt;
        return token;
    }

    /** Neither rotated, revoked nor expired at {@code now}. */
    public boolean isActive(Instant now) {
        return rotatedAt == null && revokedAt == null && now.isBefore(expiresAt);
    }

    public boolean isRotated() {
        return rotatedAt != null;
    }

    public void rotate(Instant now) {
        rotatedAt = now;
    }

    public void revoke(Instant now) {
        if (revokedAt == null) {
            revokedAt = now;
        }
    }
}
