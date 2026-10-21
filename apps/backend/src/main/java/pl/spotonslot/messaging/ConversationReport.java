package pl.spotonslot.messaging;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * What a report of a conversation keeps: the other side's accounts and name as the reporter saw them, and the newest
 * messages (oldest first). Booking threads are reported the same way.
 */
public record ConversationReport(UUID conversationId, ConversationKind kind, ConversationSide reporterSide,
        Set<UUID> otherSide, String otherName, List<Message> messages) {

    /** One message of the copy: {@code reporter} = written by the reporter's side. */
    public record Message(ConversationSide side, boolean reporter, String body, boolean deleted, Instant createdAt) {
    }
}
