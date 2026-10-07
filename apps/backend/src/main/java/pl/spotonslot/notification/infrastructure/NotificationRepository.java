package pl.spotonslot.notification.infrastructure;

import java.time.Instant;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pl.spotonslot.notification.NotificationType;
import pl.spotonslot.notification.domain.Notification;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    /** Newest first. */
    @Query("SELECT n FROM Notification n WHERE n.recipientId = :recipientId ORDER BY n.createdAt DESC, n.id DESC")
    Page<Notification> findOfRecipient(@Param("recipientId") UUID recipientId, Pageable pageable);

    Optional<Notification> findByIdAndRecipientId(UUID id, UUID recipientId);

    long countByRecipientIdAndReadAtIsNull(UUID recipientId);

    @Modifying
    @Query("UPDATE Notification n SET n.readAt = :now, n.version = n.version + 1"
            + " WHERE n.recipientId = :recipientId AND n.readAt IS NULL")
    int markAllRead(@Param("recipientId") UUID recipientId, @Param("now") Instant now);

    @Query("SELECT n.recipientId FROM Notification n WHERE n.listingId = :listingId")
    Set<UUID> findRecipientsOfListing(@Param("listingId") UUID listingId);

    @Query("SELECT count(n) FROM Notification n WHERE n.recipientId = :recipientId AND n.type = :type"
            + " AND n.emailSentAt >= :since")
    long countEmailedSince(@Param("recipientId") UUID recipientId, @Param("type") NotificationType type,
            @Param("since") Instant since);

    @Modifying
    @Query("DELETE FROM Notification n WHERE n.recipientId = :recipientId")
    int deleteOfRecipient(@Param("recipientId") UUID recipientId);

    @Modifying
    @Query("DELETE FROM Notification n WHERE n.createdAt < :before")
    int deleteCreatedBefore(@Param("before") Instant before);
}
