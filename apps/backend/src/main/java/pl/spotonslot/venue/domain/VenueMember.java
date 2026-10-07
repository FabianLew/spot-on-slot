package pl.spotonslot.venue.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import pl.spotonslot.shared.persistence.BaseEntity;
import pl.spotonslot.venue.VenueRole;

/** A person in a venue's team. */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "venue_member")
public class VenueMember extends BaseEntity {

    @Column(name = "venue_id", nullable = false, updatable = false)
    private UUID venueId;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 16)
    private VenueRole role;

    public static VenueMember of(UUID venueId, UUID userId, VenueRole role) {
        var member = new VenueMember();
        member.venueId = venueId;
        member.userId = userId;
        member.role = role;
        return member;
    }

    /** Used when the last owner's account is purged, so the venue keeps an owner. */
    public void promoteToOwner() {
        role = VenueRole.OWNER;
    }

    public boolean isOwner() {
        return role == VenueRole.OWNER;
    }
}
