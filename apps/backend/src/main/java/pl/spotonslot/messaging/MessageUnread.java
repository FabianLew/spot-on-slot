package pl.spotonslot.messaging;

import java.util.UUID;

/**
 * A message from {@code senderName}'s side has waited unread for a while; the recipient gets one reminder per
 * conversation until they read it. {@code bookingId} is set for a booking's thread.
 */
public record MessageUnread(UUID conversationId, UUID recipientId, ConversationKind kind, UUID bookingId,
        String senderName) {
}
