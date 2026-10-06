package pl.spotonslot.venue.application;

import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import pl.spotonslot.venue.domain.VenueErrors;
import pl.spotonslot.venue.domain.VenueMember;
import pl.spotonslot.venue.infrastructure.VenueMemberRepository;

/** Team checks: to anyone outside the team a venue does not exist; owner-only actions refuse managers. */
@Component
@RequiredArgsConstructor
class VenueAccess {

    private final VenueMemberRepository members;

    VenueMember member(UUID venueId, UUID userId) {
        return members.findByVenueIdAndUserId(venueId, userId).orElseThrow(VenueErrors.VenueNotFound::new);
    }

    VenueMember owner(UUID venueId, UUID userId) {
        var member = member(venueId, userId);
        if (!member.isOwner()) {
            throw new VenueErrors.OwnerOnly();
        }
        return member;
    }
}
