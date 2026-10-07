package pl.spotonslot.notification.infrastructure;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pl.spotonslot.notification.domain.NotificationPreference;

public interface NotificationPreferenceRepository extends JpaRepository<NotificationPreference, UUID> {

    Optional<NotificationPreference> findByUserId(UUID userId);

    List<NotificationPreference> findByUserIdIn(Collection<UUID> userIds);

    Optional<NotificationPreference> findByUnsubscribeToken(String token);

    /** Stores the defaults unless the user has settings already; safe when two writers race. */
    @Modifying
    @Query(nativeQuery = true, value = """
            INSERT INTO notification_preference (id, created_at, updated_at, version, user_id, nearby_enabled,
                                                 nearby_email, unsubscribe_token)
            VALUES (:id, now(), now(), 0, :userId, true, true, :token)
            ON CONFLICT (user_id) DO NOTHING""")
    int insertDefaults(@Param("id") UUID id, @Param("userId") UUID userId, @Param("token") String token);
}
