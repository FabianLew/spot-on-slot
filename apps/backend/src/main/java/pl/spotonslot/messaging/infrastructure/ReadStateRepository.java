package pl.spotonslot.messaging.infrastructure;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pl.spotonslot.messaging.domain.ReadState;

public interface ReadStateRepository extends JpaRepository<ReadState, UUID> {

    Optional<ReadState> findByConversationIdAndUserId(UUID conversationId, UUID userId);

    List<ReadState> findByConversationIdIn(Collection<UUID> conversationIds);

    /** Stores an empty state unless the person has one; safe when two writers race. */
    @Modifying(flushAutomatically = true)
    @Query(nativeQuery = true, value = """
            INSERT INTO conversation_read (id, created_at, updated_at, version, conversation_id, user_id)
            VALUES (:id, now(), now(), 0, :conversationId, :userId)
            ON CONFLICT (conversation_id, user_id) DO NOTHING""")
    int insertEmpty(@Param("id") UUID id, @Param("conversationId") UUID conversationId,
            @Param("userId") UUID userId);
}
