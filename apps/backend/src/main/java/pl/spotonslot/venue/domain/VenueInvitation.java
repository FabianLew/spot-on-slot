package pl.spotonslot.venue.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import pl.spotonslot.shared.persistence.BaseEntity;
import pl.spotonslot.venue.VenueRole;

/** A pending invitation to a venue's team; deleted once accepted. Only the token's hash is stored. */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "venue_invitation")
public class VenueInvitation extends BaseEntity {

    public static final Duration VALIDITY = Duration.ofDays(7);

    @Column(name = "venue_id", nullable = false, updatable = false)
    private UUID venueId;

    @Column(name = "email", nullable = false, length = 254, updatable = false)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 16)
    private VenueRole role;

    @Column(name = "token_hash", nullable = false, length = 64)
    private String tokenHash;

    @Column(name = "invited_by", nullable = false)
    private UUID invitedBy;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    public static VenueInvitation create(UUID venueId, String email, VenueRole role, String tokenHash,
            UUID invitedBy, Instant now) {
        var invitation = new VenueInvitation();
        invitation.venueId = venueId;
        invitation.email = email;
        invitation.role = role;
        invitation.tokenHash = tokenHash;
        invitation.invitedBy = invitedBy;
        invitation.expiresAt = now.plus(VALIDITY);
        return invitation;
    }

    public boolean isExpired(Instant now) {
        return !now.isBefore(expiresAt);
    }
}
