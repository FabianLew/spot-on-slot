package pl.spotonslot.venue.domain;

import pl.spotonslot.shared.error.BusinessRuleException;
import pl.spotonslot.shared.error.ConflictException;
import pl.spotonslot.shared.error.ForbiddenException;
import pl.spotonslot.shared.error.InvalidRequestException;
import pl.spotonslot.shared.error.NotFoundException;

/** Venue failures with their problem codes. */
public final class VenueErrors {

    private VenueErrors() {
    }

    /** No such venue, the caller is not in its team, or (publicly) it is not published. */
    public static class VenueNotFound extends NotFoundException {
        public VenueNotFound() {
            super("VENUE_NOT_FOUND");
        }
    }

    public static class SlugTaken extends ConflictException {
        public SlugTaken() {
            super("VENUE_SLUG_TAKEN");
        }
    }

    public static class SlugReserved extends InvalidRequestException {
        public SlugReserved() {
            super("VENUE_SLUG_RESERVED");
        }
    }

    /** Publishing needs a name, a type, an address with a point, a genre and a main photo. */
    public static class ProfileIncomplete extends BusinessRuleException {
        public ProfileIncomplete() {
            super("VENUE_PROFILE_INCOMPLETE");
        }
    }

    /** A newly added photo that does not exist or belongs to someone other than the person saving. */
    public static class MediaNotOwned extends InvalidRequestException {
        public MediaNotOwned() {
            super("VENUE_MEDIA_NOT_OWNED");
        }
    }

    /** A person can be in at most {@code Venue.MAX_PER_USER} venue teams. */
    public static class LimitReached extends BusinessRuleException {
        public LimitReached() {
            super("VENUE_LIMIT_REACHED");
        }
    }

    /** A manager tried something only owners may do. */
    public static class OwnerOnly extends ForbiddenException {
        public OwnerOnly() {
            super("VENUE_FORBIDDEN");
        }
    }

    /** The change would leave the venue without an owner. */
    public static class LastOwner extends BusinessRuleException {
        public LastOwner() {
            super("VENUE_LAST_OWNER");
        }
    }

    /** Unknown, expired or used token, or an account that does not match the invitation. */
    public static class InvitationInvalid extends InvalidRequestException {
        public InvitationInvalid() {
            super("VENUE_INVITATION_INVALID");
        }
    }

    public static class AlreadyMember extends ConflictException {
        public AlreadyMember() {
            super("VENUE_ALREADY_MEMBER");
        }
    }

    /** Two saves raced on a unique constraint (slug, membership, invitation). */
    public static class ConcurrentUpdate extends ConflictException {
        public ConcurrentUpdate() {
            super("VENUE_CONFLICT");
        }
    }
}
