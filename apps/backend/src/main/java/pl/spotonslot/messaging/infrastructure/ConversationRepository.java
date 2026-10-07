package pl.spotonslot.messaging.infrastructure;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pl.spotonslot.messaging.ConversationKind;
import pl.spotonslot.messaging.domain.Conversation;

public interface ConversationRepository extends JpaRepository<Conversation, UUID> {

    Optional<Conversation> findByKindAndArtistIdAndVenueId(ConversationKind kind, UUID artistId, UUID venueId);

    Optional<Conversation> findByBookingId(UUID bookingId);

    List<Conversation> findByBookingIdIn(Collection<UUID> bookingIds);

    long countByStartedByAndCreatedAtGreaterThanEqual(UUID startedBy, Instant from);

    /**
     * Conversations with messages where the user is the artist or the venue is one of {@code venueIds} (never
     * empty), latest activity first.
     */
    @Query(value = """
            SELECT c FROM Conversation c
            WHERE c.lastMessageAt IS NOT NULL AND (c.artistId = :userId OR c.venueId IN :venueIds)
            ORDER BY c.lastMessageAt DESC, c.id DESC""",
            countQuery = """
            SELECT count(c) FROM Conversation c
            WHERE c.lastMessageAt IS NOT NULL AND (c.artistId = :userId OR c.venueId IN :venueIds)""")
    Page<Conversation> findActiveOf(@Param("userId") UUID userId, @Param("venueIds") Collection<UUID> venueIds,
            Pageable pageable);

    /** Conversations written in since {@code since}: the ones that may hold messages to remind about. */
    List<Conversation> findByLastMessageAtAfter(Instant since);
}
