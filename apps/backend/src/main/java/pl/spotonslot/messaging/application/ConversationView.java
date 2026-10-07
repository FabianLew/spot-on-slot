package pl.spotonslot.messaging.application;

import java.time.Instant;
import pl.spotonslot.messaging.ConversationSide;
import pl.spotonslot.messaging.domain.Conversation;

/**
 * A conversation as one of its people sees it: their side, the other side, the newest message (null in a booking
 * thread nobody wrote in yet), how many messages from the other side they have not read, and up to when the other
 * side has read (anybody on it; null = nothing yet). {@code bookingStartsAt} is the booking's current start in a booking
 * thread (null otherwise).
 */
public record ConversationView(Conversation conversation, ConversationSide viewer, Party other,
        MessageView lastMessage, long unread, Instant otherReadUpTo, Instant bookingStartsAt) {

    /** The other side: its public name and address (null once unpublished) and the small photo URL. */
    public record Party(String name, String slug, String photoUrl) {
    }
}
