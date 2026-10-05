package pl.spotonslot.identity;

/** Account role. Registration offers {@link #ARTIST} and {@link #VENUE}; the others are not self-service. */
public enum Role {
    ARTIST,
    VENUE,
    BOOKER,
    ADMIN
}
