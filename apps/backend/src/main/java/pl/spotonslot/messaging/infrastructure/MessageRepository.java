package pl.spotonslot.messaging.infrastructure;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pl.spotonslot.messaging.ConversationSide;
import pl.spotonslot.messaging.domain.ConversationMessage;

public interface MessageRepository extends JpaRepository<ConversationMessage, UUID> {

    Optional<ConversationMessage> findByIdAndConversationId(UUID id, UUID conversationId);

    Optional<ConversationMessage> findByConversationIdAndSenderIdAndClientId(UUID conversationId, UUID senderId,
            String clientId);

    long countBySenderIdAndCreatedAtAfter(UUID senderId, Instant after);

    @Query("""
            SELECT m FROM ConversationMessage m WHERE m.conversationId = :conversationId
            ORDER BY m.createdAt DESC, m.id DESC""")
    List<ConversationMessage> findNewest(@Param("conversationId") UUID conversationId, Limit limit);

    /** Messages older than the one at ({@code createdAt}, {@code id}), newest first. */
    @Query("""
            SELECT m FROM ConversationMessage m WHERE m.conversationId = :conversationId
              AND (m.createdAt < :createdAt OR (m.createdAt = :createdAt AND m.id < :id))
            ORDER BY m.createdAt DESC, m.id DESC""")
    List<ConversationMessage> findOlder(@Param("conversationId") UUID conversationId,
            @Param("createdAt") Instant createdAt, @Param("id") UUID id, Limit limit);

    /** The newest message of each of the conversations. */
    @Query(nativeQuery = true, value = """
            SELECT DISTINCT ON (conversation_id) * FROM conversation_message
            WHERE conversation_id IN (:conversationIds)
            ORDER BY conversation_id, created_at DESC, id DESC""")
    List<ConversationMessage> findLatestOf(@Param("conversationIds") Collection<UUID> conversationIds);

    /** The oldest message from {@code side}. */
    Optional<ConversationMessage> findFirstByConversationIdAndSenderSideOrderByCreatedAtAscIdAsc(
            UUID conversationId, ConversationSide side);

    /** The oldest message from {@code side} after {@code after}. */
    Optional<ConversationMessage> findFirstByConversationIdAndSenderSideAndCreatedAtAfterOrderByCreatedAtAscIdAsc(
            UUID conversationId, ConversationSide side, Instant after);

    /**
     * Messages from the other side that the user has not read, per conversation: as the artist of a conversation the
     * venue's, as a member of one of {@code venueIds} (never empty) the artist's.
     */
    @Query(nativeQuery = true, value = """
            SELECT m.conversation_id AS conversationId, count(*) AS unread
            FROM conversation_message m
                     JOIN conversation c ON c.id = m.conversation_id
                     LEFT JOIN conversation_read r ON r.conversation_id = c.id AND r.user_id = :userId
            WHERE ((c.artist_id = :userId AND m.sender_side = 'VENUE')
                OR (c.venue_id IN (:venueIds) AND m.sender_side = 'ARTIST'))
              AND (r.read_up_to IS NULL OR m.created_at > r.read_up_to)
            GROUP BY m.conversation_id""")
    List<UnreadRow> countUnread(@Param("userId") UUID userId, @Param("venueIds") Collection<UUID> venueIds);

    interface UnreadRow {

        UUID getConversationId();

        long getUnread();
    }
}
