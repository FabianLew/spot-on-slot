package pl.spotonslot.messaging.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import pl.spotonslot.shared.persistence.BaseEntity;

/** How far a person has read a conversation, and when they were last reminded about unread messages in it. */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "conversation_read")
public class ReadState extends BaseEntity {

    @Column(name = "conversation_id", nullable = false, updatable = false)
    private UUID conversationId;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    /** The time of the newest message read; null = nothing read yet. */
    @Column(name = "read_up_to")
    private Instant readUpTo;

    @Column(name = "read_at")
    private Instant readAt;

    @Column(name = "reminded_at")
    private Instant remindedAt;

    /** Moves the mark forward to a message's time; an older message leaves it where it is. */
    public void read(Instant messageTime, Instant now) {
        if (readUpTo == null || messageTime.isAfter(readUpTo)) {
            readUpTo = messageTime;
        }
        readAt = now;
    }

    /** One reminder per conversation until the person reads it again. */
    public boolean isRemindable() {
        return remindedAt == null || readAt != null && readAt.isAfter(remindedAt);
    }

    public void reminded(Instant now) {
        remindedAt = now;
    }
}
