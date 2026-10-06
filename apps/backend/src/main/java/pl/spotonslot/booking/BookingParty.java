package pl.spotonslot.booking;

/** Who took a step of a booking: the artist, someone from the venue's team, or the system (expiry, conflicts). */
public enum BookingParty {
    ARTIST,
    VENUE,
    SYSTEM
}
