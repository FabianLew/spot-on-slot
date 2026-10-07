package pl.spotonslot.notification.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.ColumnTransformer;
import pl.spotonslot.notification.NotificationType;
import pl.spotonslot.shared.persistence.BaseEntity;

/** Something a user is told in the app; the payload holds what to show, as JSON of the type's record. */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "notification")
public class Notification extends BaseEntity {

    @Column(name = "recipient_id", nullable = false, updatable = false)
    private UUID recipientId;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, updatable = false, length = 32)
    private NotificationType type;

    @Column(name = "listing_id", updatable = false)
    private UUID listingId;

    /** JSON; plain text in Java, so each type's record is read and written by the application. */
    @ColumnTransformer(write = "?::jsonb")
    @Column(name = "payload", nullable = false, updatable = false, columnDefinition = "jsonb")
    private String payload;

    @Column(name = "read_at")
    private Instant readAt;

    @Column(name = "email_sent_at")
    private Instant emailSentAt;

    public static Notification nearbyListing(UUID recipientId, UUID listingId, String payload) {
        var notification = new Notification();
        notification.recipientId = recipientId;
        notification.type = NotificationType.NEARBY_LISTING;
        notification.listingId = listingId;
        notification.payload = payload;
        return notification;
    }

    public void markRead(Instant now) {
        if (readAt == null) {
            readAt = now;
        }
    }

    public void markEmailed(Instant now) {
        emailSentAt = now;
    }
}
