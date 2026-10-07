package pl.spotonslot.identity;

import java.util.UUID;

/** Something that has to be settled before the account can be deleted, e.g. a venue that would lose its owner. */
public record DeletionBlocker(Kind kind, UUID id, String name) {

    public enum Kind {
        /** The account is the only owner of a venue whose team has other people: hand over or delete it first. */
        LAST_VENUE_OWNER
    }
}
