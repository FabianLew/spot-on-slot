package pl.spotonslot.messaging.application;

import java.time.Instant;
import java.util.UUID;
import pl.spotonslot.messaging.ConversationSide;

/** A message for one viewer: {@code mine} = written by the viewer's side; {@code clientId} only on the viewer's own. */
public record MessageView(UUID id, UUID conversationId, ConversationSide side, boolean mine, String body,
        Instant createdAt, String clientId) {
}
