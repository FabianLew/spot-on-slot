package pl.spotonslot.messaging.domain;

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
import pl.spotonslot.messaging.ConversationKind;
import pl.spotonslot.messaging.ConversationSide;
import pl.spotonslot.shared.persistence.BaseEntity;

/**
 * A conversation between an artist and a venue: the artist on one side, the venue's current team on the other. A
 * direct one can be blocked by either side; a booking's thread cannot, since it is about an agreed gig.
 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "conversation")
public class Conversation extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false, updatable = false, length = 16)
    private ConversationKind kind;

    @Column(name = "artist_id", nullable = false, updatable = false)
    private UUID artistId;

    @Column(name = "venue_id", nullable = false, updatable = false)
    private UUID venueId;

    @Column(name = "booking_id", updatable = false)
    private UUID bookingId;

    @Column(name = "artist_name", nullable = false, updatable = false, length = 60)
    private String artistName;

    @Column(name = "venue_name", nullable = false, updatable = false, length = 120)
    private String venueName;

    @Column(name = "started_by", updatable = false)
    private UUID startedBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "blocked_by", length = 16)
    private ConversationSide blockedBy;

    @Column(name = "blocked_at")
    private Instant blockedAt;

    @Column(name = "last_message_at")
    private Instant lastMessageAt;

    public static Conversation direct(UUID artistId, UUID venueId, String artistName, String venueName,
            UUID startedBy) {
        var conversation = new Conversation();
        conversation.kind = ConversationKind.DIRECT;
        conversation.artistId = artistId;
        conversation.venueId = venueId;
        conversation.artistName = artistName;
        conversation.venueName = venueName;
        conversation.startedBy = startedBy;
        return conversation;
    }

    public static Conversation booking(UUID bookingId, UUID artistId, UUID venueId, String artistName,
            String venueName) {
        var conversation = new Conversation();
        conversation.kind = ConversationKind.BOOKING;
        conversation.bookingId = bookingId;
        conversation.artistId = artistId;
        conversation.venueId = venueId;
        conversation.artistName = artistName;
        conversation.venueName = venueName;
        return conversation;
    }

    /** Nobody writes in a blocked direct conversation, the side that blocked included (it unblocks first). */
    public boolean isWritable() {
        return blockedBy == null;
    }

    /** Blocks the other side; a block by the other side stays as it is. */
    public void block(ConversationSide by, Instant now) {
        if (kind != ConversationKind.DIRECT) {
            throw new MessagingErrors.DirectOnly();
        }
        if (blockedBy == null) {
            blockedBy = by;
            blockedAt = now;
        }
    }

    /** Lifts the side's own block; another side's block stays. */
    public void unblock(ConversationSide by) {
        if (blockedBy == by) {
            blockedBy = null;
            blockedAt = null;
        }
    }

    public void messagePosted(Instant at) {
        if (lastMessageAt == null || at.isAfter(lastMessageAt)) {
            lastMessageAt = at;
        }
    }
}
