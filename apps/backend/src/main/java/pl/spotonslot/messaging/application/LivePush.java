package pl.spotonslot.messaging.application;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import pl.spotonslot.messaging.ConversationSide;
import pl.spotonslot.messaging.domain.Conversation;
import pl.spotonslot.messaging.domain.ConversationMessage;
import pl.spotonslot.venue.Venues;

/**
 * Sends new messages and read receipts to everybody in a conversation over STOMP ({@code /user/queue/messages}),
 * once the transaction has committed. Delivery is best effort: a page that missed something reloads over REST.
 */
@Slf4j
@Component
@RequiredArgsConstructor
class LivePush {

    static final String QUEUE = "/queue/messages";

    private final SimpMessagingTemplate messaging;
    private final Venues venues;

    /** {@code type} = {@code MESSAGE}. */
    record LiveMessage(String type, UUID conversationId, MessageView message) {
    }

    /** {@code type} = {@code READ}: {@code side} has read up to {@code readUpTo} (the time of {@code messageId}). */
    record LiveRead(String type, UUID conversationId, ConversationSide side, Instant readUpTo, UUID messageId) {
    }

    void message(Conversation conversation, ConversationMessage message) {
        afterCommit(conversation, (user, side) -> new LiveMessage("MESSAGE", conversation.getId(),
                ConversationService.view(message, side)));
    }

    void read(Conversation conversation, ConversationSide side, Instant readUpTo, UUID messageId) {
        var payload = new LiveRead("READ", conversation.getId(), side, readUpTo, messageId);
        afterCommit(conversation, (user, viewer) -> payload);
    }

    private interface Payload {
        Object forUser(UUID userId, ConversationSide side);
    }

    private void afterCommit(Conversation conversation, Payload payload) {
        Runnable send = () -> {
            var people = new LinkedHashSet<UUID>();
            people.add(conversation.getArtistId());
            var team = venues.teamsOf(List.of(conversation.getVenueId())).get(conversation.getVenueId());
            if (team != null) {
                people.addAll(team);
            }
            for (var user : people) {
                var side = user.equals(conversation.getArtistId()) ? ConversationSide.ARTIST : ConversationSide.VENUE;
                try {
                    messaging.convertAndSendToUser(user.toString(), QUEUE, payload.forUser(user, side));
                } catch (RuntimeException e) {
                    log.warn("Live delivery failed: {}", e.getMessage());
                }
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    send.run();
                }
            });
        } else {
            send.run();
        }
    }
}
