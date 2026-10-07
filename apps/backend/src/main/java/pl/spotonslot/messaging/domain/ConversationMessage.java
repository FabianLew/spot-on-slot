package pl.spotonslot.messaging.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import pl.spotonslot.messaging.ConversationSide;
import pl.spotonslot.shared.persistence.BaseEntity;

/** A text message; it cannot be edited or deleted. Its {@code createdAt} orders the history. */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "conversation_message")
public class ConversationMessage extends BaseEntity {

    public static final int MAX_LENGTH = 2000;

    @Column(name = "conversation_id", nullable = false, updatable = false)
    private UUID conversationId;

    @Column(name = "sender_id", nullable = false, updatable = false)
    private UUID senderId;

    @Enumerated(EnumType.STRING)
    @Column(name = "sender_side", nullable = false, updatable = false, length = 16)
    private ConversationSide senderSide;

    @Column(name = "body", nullable = false, updatable = false, length = MAX_LENGTH)
    private String body;

    @Column(name = "client_id", updatable = false, length = 64)
    private String clientId;

    public ConversationMessage(UUID conversationId, UUID senderId, ConversationSide senderSide, String body,
            String clientId) {
        this.conversationId = conversationId;
        this.senderId = senderId;
        this.senderSide = senderSide;
        this.body = body;
        this.clientId = clientId;
    }
}
