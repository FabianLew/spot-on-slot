package pl.spotonslot.messaging;

/** The two sides of every conversation: the artist, and the venue (its whole team). */
public enum ConversationSide {
    ARTIST,
    VENUE;

    public ConversationSide other() {
        return this == ARTIST ? VENUE : ARTIST;
    }
}
