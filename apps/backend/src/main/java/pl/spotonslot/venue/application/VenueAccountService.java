package pl.spotonslot.venue.application;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.spotonslot.identity.DeletionBlocker;
import pl.spotonslot.venue.VenueRole;
import pl.spotonslot.venue.VenuesDeletedWithAccount;
import pl.spotonslot.venue.domain.VenueMember;
import pl.spotonslot.venue.infrastructure.VenueInvitationRepository;
import pl.spotonslot.venue.infrastructure.VenueMemberRepository;
import pl.spotonslot.venue.infrastructure.VenueRepository;

/**
 * What an account's deletion means for venues: the last owner of a team with other people cannot leave it (the rule
 * {@link VenueTeamService#removeMember} applies to leaving); venues nobody else is in are unpublished at the request
 * and deleted with the account; elsewhere only the membership and the invitations the person sent go.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class VenueAccountService {

    private final VenueRepository venues;
    private final VenueMemberRepository members;
    private final VenueInvitationRepository invitations;
    private final ApplicationEventPublisher events;

    /** Venues whose only owner is the user while other people are in the team. */
    @Transactional(readOnly = true)
    public List<DeletionBlocker> lastOwnerBlockers(UUID userId) {
        var blockers = new ArrayList<DeletionBlocker>();
        for (var membership : members.findByUserIdOrderByCreatedAtAsc(userId)) {
            var venueId = membership.getVenueId();
            if (membership.isOwner() && members.countByVenueIdAndRole(venueId, VenueRole.OWNER) <= 1
                    && members.countByVenueId(venueId) > 1) {
                venues.findById(venueId).ifPresent(venue -> blockers.add(new DeletionBlocker(
                        DeletionBlocker.Kind.LAST_VENUE_OWNER, venue.getId(), venue.getName())));
            }
        }
        return blockers;
    }

    /** Venues whose team is the user alone. */
    @Transactional(readOnly = true)
    public Set<UUID> soleMemberVenues(UUID userId) {
        var sole = new LinkedHashSet<UUID>();
        for (var membership : members.findByUserIdOrderByCreatedAtAsc(userId)) {
            if (members.countByVenueId(membership.getVenueId()) == 1) {
                sole.add(membership.getVenueId());
            }
        }
        return sole;
    }

    /** Takes the user's own venues off the public pages (deletion requested); a restore leaves them unpublished. */
    @Transactional
    public void hideSoleVenues(UUID userId) {
        venues.findAllById(soleMemberVenues(userId)).forEach(venue -> venue.unpublish());
    }

    /**
     * Removes the purged user from every team. Venues they were alone in are deleted (with their invitations);
     * a team left without an owner gets its longest-standing member as owner.
     */
    @Transactional
    public void removePurgedAccount(UUID userId) {
        var deleted = new LinkedHashSet<UUID>();
        for (var membership : members.findByUserIdOrderByCreatedAtAsc(userId)) {
            var venueId = membership.getVenueId();
            if (members.countByVenueId(venueId) <= 1) {
                venues.deleteById(venueId);
                deleted.add(venueId);
                continue;
            }
            members.delete(membership);
            members.flush();
            if (members.countByVenueIdAndRole(venueId, VenueRole.OWNER) == 0) {
                members.findByVenueIdOrderByCreatedAtAsc(venueId).stream()
                        .min(Comparator.comparing(VenueMember::getCreatedAt))
                        .ifPresent(VenueMember::promoteToOwner);
            }
        }
        invitations.deleteByInvitedBy(userId);
        if (!deleted.isEmpty()) {
            events.publishEvent(new VenuesDeletedWithAccount(userId, Set.copyOf(deleted)));
        }
        log.info("Removed a purged account from venue teams; {} venues deleted with it", deleted.size());
    }
}
