package pl.spotonslot.messaging;

import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import pl.spotonslot.messaging.application.ConversationService;

/** The module's facade for other modules (the dashboard). */
@Service
@RequiredArgsConstructor
public class Conversations {

    private final ConversationService conversations;

    /** How many of the user's conversations have messages from the other side they have not read. */
    public long unreadCount(UUID userId) {
        return conversations.unread(userId).conversations();
    }
}
