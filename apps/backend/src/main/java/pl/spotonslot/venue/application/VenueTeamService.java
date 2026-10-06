package pl.spotonslot.venue.application;

import java.time.Clock;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import pl.spotonslot.identity.Accounts;
import pl.spotonslot.identity.Role;
import pl.spotonslot.shared.security.SecretToken;
import pl.spotonslot.venue.VenueInvitationSent;
import pl.spotonslot.venue.VenueRole;
import pl.spotonslot.venue.domain.Venue;
import pl.spotonslot.venue.domain.VenueErrors;
import pl.spotonslot.venue.domain.VenueInvitation;
import pl.spotonslot.venue.domain.VenueMember;
import pl.spotonslot.venue.infrastructure.VenueInvitationRepository;
import pl.spotonslot.venue.infrastructure.VenueMemberRepository;
import pl.spotonslot.venue.infrastructure.VenueRepository;

/** A venue's team: members, e-mail invitations, leaving and removing. A venue always keeps at least one owner. */
@Service
@RequiredArgsConstructor
public class VenueTeamService {

    /** The team as its members see it; e-mails come from identity, pending invitations are the unexpired ones. */
    public record Team(List<VenueMember> members, Map<UUID, String> emails, List<VenueInvitation> invitations) {
    }

    private final VenueRepository venues;
    private final VenueMemberRepository members;
    private final VenueInvitationRepository invitations;
    private final VenueAccess access;
    private final Accounts accounts;
    private final ApplicationEventPublisher events;
    private final TransactionTemplate transaction;
    private final Clock clock;

    @Transactional(readOnly = true)
    public Team get(UUID userId, UUID venueId) {
        access.member(venueId, userId);
        var team = members.findByVenueIdOrderByCreatedAtAsc(venueId);
        var now = clock.instant();
        var pending = invitations.findByVenueIdOrderByCreatedAtAsc(venueId).stream()
                .filter(invitation -> !invitation.isExpired(now))
                .toList();
        return new Team(team, accounts.emails(team.stream().map(VenueMember::getUserId).toList()), pending);
    }

    /**
     * Invites {@code email} (owners only). A new invitation to the same address replaces the pending one, so the
     * old link stops working. The e-mail goes out after the transaction commits.
     */
    public VenueInvitation invite(UUID userId, UUID venueId, String email, VenueRole role, Locale locale) {
        var address = normalize(email);
        return inTransaction(() -> {
            access.owner(venueId, userId);
            var venue = venues.findById(venueId).orElseThrow(VenueErrors.VenueNotFound::new);
            var team = members.findByVenueIdOrderByCreatedAtAsc(venueId);
            if (accounts.emails(team.stream().map(VenueMember::getUserId).toList()).containsValue(address)) {
                throw new VenueErrors.AlreadyMember();
            }
            invitations.findByVenueIdAndEmail(venueId, address).ifPresent(previous -> {
                invitations.delete(previous);
                invitations.flush();
            });
            var token = SecretToken.generate();
            var invitation = invitations.saveAndFlush(VenueInvitation.create(venueId, address, role,
                    SecretToken.hash(token), userId, clock.instant()));
            events.publishEvent(new VenueInvitationSent(address, locale.getLanguage(), token, venue.getName(), role,
                    invitation.getExpiresAt()));
            return invitation;
        });
    }

    /** Owners withdraw a pending invitation; withdrawing one that is gone is not an error. */
    @Transactional
    public void cancelInvitation(UUID userId, UUID venueId, UUID invitationId) {
        access.owner(venueId, userId);
        invitations.findByIdAndVenueId(invitationId, venueId).ifPresent(invitations::delete);
    }

    /** Owners remove anyone; everyone may leave. The last owner can do neither to themselves. */
    @Transactional
    public void removeMember(UUID userId, UUID venueId, UUID memberId) {
        var actor = access.member(venueId, userId);
        if (!userId.equals(memberId) && !actor.isOwner()) {
            throw new VenueErrors.OwnerOnly();
        }
        var member = members.findByVenueIdAndUserId(venueId, memberId).orElse(null);
        if (member == null) {
            return;
        }
        if (member.isOwner() && members.countByVenueIdAndRole(venueId, VenueRole.OWNER) <= 1) {
            throw new VenueErrors.LastOwner();
        }
        members.delete(member);
    }

    /**
     * Joins the team with the invited role. Only a VENUE account signed in with the invited address may accept; any
     * mismatch looks like an invalid link, so the token reveals nothing about the invitation.
     */
    public ManagedVenue accept(UUID userId, String token) {
        return inTransaction(() -> {
            var invitation = invitations.findByTokenHash(SecretToken.hash(token))
                    .filter(found -> !found.isExpired(clock.instant()))
                    .orElseThrow(VenueErrors.InvitationInvalid::new);
            var account = accounts.find(userId)
                    .filter(found -> found.role() == Role.VENUE && found.email().equals(invitation.getEmail()))
                    .orElseThrow(VenueErrors.InvitationInvalid::new);
            if (members.findByVenueIdAndUserId(invitation.getVenueId(), account.id()).isPresent()) {
                throw new VenueErrors.AlreadyMember();
            }
            if (members.countByUserId(account.id()) >= Venue.MAX_PER_USER) {
                throw new VenueErrors.LimitReached();
            }
            members.saveAndFlush(VenueMember.of(invitation.getVenueId(), account.id(), invitation.getRole()));
            invitations.delete(invitation);
            var venue = venues.findById(invitation.getVenueId()).orElseThrow(VenueErrors.VenueNotFound::new);
            return new ManagedVenue(VenueService.loaded(venue), invitation.getRole());
        });
    }

    private <T> T inTransaction(Supplier<T> work) {
        try {
            return transaction.execute(status -> work.get());
        } catch (DataIntegrityViolationException e) {
            // Two invitations or acceptances raced on a unique constraint.
            throw new VenueErrors.ConcurrentUpdate();
        }
    }

    private static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
