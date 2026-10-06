package pl.spotonslot.listing.domain;

public enum ListingStatus {
    ACTIVE,
    /** Closed by its author. */
    CLOSED,
    /** Its time started, or (artists) left the calendar. */
    EXPIRED,
    /** Taken by a booking made from it (B10). */
    FILLED
}
