package pl.spotonslot.messaging;

import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import pl.spotonslot.messaging.application.ConversationService;
import pl.spotonslot.messaging.domain.MessagingErrors;

/** The module's facade for other modules (the dashboard, moderation). */
@Service
@RequiredArgsConstructor
public class Conversations {

    private final ConversationService conversations;

    /** How many of the user's conversations have messages from the other side they have not read. */
    public long unreadCount(UUID userId) {
        return conversations.unread(userId).conversations();
    }

    /**
     * A copy of the conversation's newest {@code size} messages and its other side, for a report by one of its
     * people; empty when the user is not in it (or it does not exist).
     */
    public Optional<ConversationReport> reportOf(UUID userId, UUID conversationId, int size) {
        try {
            return Optional.of(conversations.reportOf(userId, conversationId, size));
        } catch (MessagingErrors.ConversationNotFound e) {
            return Optional.empty();
        }
    }
}
