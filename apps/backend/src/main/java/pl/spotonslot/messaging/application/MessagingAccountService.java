package pl.spotonslot.messaging.application;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.spotonslot.messaging.ConversationKind;
import pl.spotonslot.messaging.ConversationSide;
import pl.spotonslot.messaging.infrastructure.ConversationRepository;
import pl.spotonslot.messaging.infrastructure.MessageRepository;
import pl.spotonslot.venue.Venues;

/**
 * Conversations and account deletion: the export of everything a person can read, and, after the purge, the
 * conversations kept for the other side with the purged person's name and messages erased.
 */
@Service
@RequiredArgsConstructor
public class MessagingAccountService {

    /** The name a purged account's conversations show instead of its stage or venue name. */
    public static final String DELETED_NAME = "Usunięte konto";
    private static final List<UUID> NONE = List.of(new UUID(0, 0));

    private final ConversationRepository conversations;
    private final MessageRepository messages;
    private final Venues venues;
    private final JdbcTemplate jdbc;

    public record ConversationExport(UUID id, ConversationKind kind, UUID bookingId, String artistName,
            String venueName, ConversationSide mySide, Instant startedAt, List<MessageExport> messages) {
    }

    /** {@code sentByMe} = written by the person themselves (not just their side). */
    public record MessageExport(ConversationSide side, boolean sentByMe, String body, boolean deleted,
            Instant sentAt) {
    }

    /** The person's conversations as the artist and of their venues, each with every message. */
    @Transactional(readOnly = true)
    public List<ConversationExport> export(UUID userId) {
        var venueIds = venues.findManagedBy(userId).stream().map(member -> member.venueId()).toList();
        return conversations.findAllOf(userId, venueIds.isEmpty() ? NONE : venueIds).stream()
                .map(conversation -> new ConversationExport(conversation.getId(), conversation.getKind(),
                        conversation.getBookingId(), conversation.getArtistName(), conversation.getVenueName(),
                        userId.equals(conversation.getArtistId()) ? ConversationSide.ARTIST : ConversationSide.VENUE,
                        conversation.getCreatedAt(),
                        messages.findByConversationIdOrderByCreatedAtAscIdAsc(conversation.getId()).stream()
                                .map(message -> new MessageExport(message.getSenderSide(),
                                        userId.equals(message.getSenderId()), message.getBody(), message.isDeleted(),
                                        message.getCreatedAt()))
                                .toList()))
                .toList();
    }

    /**
     * After an account is purged: its name in conversations where it was the artist becomes {@link #DELETED_NAME},
     * the text of every message it wrote is erased, and its read state goes.
     */
    @Transactional
    public void anonymizeAccount(UUID userId) {
        jdbc.update("UPDATE conversation SET artist_name = ?, updated_at = now(), version = version + 1"
                + " WHERE artist_id = ?", DELETED_NAME, userId);
        jdbc.update("UPDATE conversation_message SET body = '', deleted = true, updated_at = now(),"
                + " version = version + 1 WHERE sender_id = ? AND NOT deleted", userId);
        jdbc.update("DELETE FROM conversation_read WHERE user_id = ?", userId);
    }

    /** After venues went with a purged account: their names in conversations become {@link #DELETED_NAME}. */
    @Transactional
    public void anonymizeVenues(Set<UUID> venueIds) {
        venueIds.forEach(venueId -> jdbc.update("UPDATE conversation SET venue_name = ?, updated_at = now(),"
                + " version = version + 1 WHERE venue_id = ?", DELETED_NAME, venueId));
    }
}
