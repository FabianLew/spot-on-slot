package pl.spotonslot.messaging.application;

import java.time.Instant;
import java.util.List;

/** Messages newest first, whether older ones exist, and up to when the other side has read. */
public record MessagePage(List<MessageView> messages, boolean hasMore, Instant otherReadUpTo) {
}
