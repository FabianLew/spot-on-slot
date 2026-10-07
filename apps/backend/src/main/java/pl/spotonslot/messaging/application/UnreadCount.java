package pl.spotonslot.messaging.application;

/** Conversations with unread messages, and those messages. */
public record UnreadCount(long conversations, long messages) {
}
