package pl.spotonslot.artist.domain;

import pl.spotonslot.shared.error.BusinessRuleException;
import pl.spotonslot.shared.error.ConflictException;
import pl.spotonslot.shared.error.InvalidRequestException;
import pl.spotonslot.shared.error.NotFoundException;

/** Artist profile failures with their problem codes. */
public final class ArtistErrors {

    private ArtistErrors() {
    }

    /** No profile yet, or (publicly) no published profile under that slug. */
    public static class ProfileNotFound extends NotFoundException {
        public ProfileNotFound() {
            super("ARTIST_PROFILE_NOT_FOUND");
        }
    }

    public static class SlugTaken extends ConflictException {
        public SlugTaken() {
            super("ARTIST_SLUG_TAKEN");
        }
    }

    public static class SlugReserved extends InvalidRequestException {
        public SlugReserved() {
            super("ARTIST_SLUG_RESERVED");
        }
    }

    /** Publishing needs a stage name, a genre, a main photo and a location. */
    public static class ProfileIncomplete extends BusinessRuleException {
        public ProfileIncomplete() {
            super("ARTIST_PROFILE_INCOMPLETE");
        }
    }

    /** A photo that does not exist or belongs to someone else. */
    public static class MediaNotOwned extends InvalidRequestException {
        public MediaNotOwned() {
            super("ARTIST_MEDIA_NOT_OWNED");
        }
    }

    /** Rate "from" above rate "to". */
    public static class RateRangeInvalid extends InvalidRequestException {
        public RateRangeInvalid() {
            super("ARTIST_RATE_RANGE_INVALID");
        }
    }

    /** Two first saves of the same artist raced on a unique constraint. */
    public static class ConcurrentUpdate extends ConflictException {
        public ConcurrentUpdate() {
            super("ARTIST_PROFILE_CONFLICT");
        }
    }
}
