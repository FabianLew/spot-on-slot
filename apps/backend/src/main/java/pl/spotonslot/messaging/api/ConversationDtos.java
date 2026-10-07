package pl.spotonslot.messaging.api;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import pl.spotonslot.messaging.ConversationKind;
import pl.spotonslot.messaging.ConversationSide;
import pl.spotonslot.messaging.application.ConversationView;
import pl.spotonslot.messaging.application.MessagePage;
import pl.spotonslot.messaging.application.MessageView;
import pl.spotonslot.messaging.application.UnreadCount;
import pl.spotonslot.messaging.domain.ConversationMessage;

/** Request and response shapes of the messaging API. */
final class ConversationDtos {

    private ConversationDtos() {
    }

    /**
     * Starts the direct conversation with a first message, or writes in it if it exists. An artist sends
     * {@code venueSlug}; a venue team member sends {@code venueId} (their venue) and {@code artistSlug}.
     * {@code clientId} makes a retried send return the stored message instead of posting it twice.
     */
    record StartConversationRequest(
            UUID venueId,
            String artistSlug,
            String venueSlug,
            @NotBlank @Size(max = ConversationMessage.MAX_LENGTH) @Schema(requiredMode = REQUIRED) String body,
            @Size(max = 64) String clientId) {
    }

    record SendMessageRequest(
            @NotBlank @Size(max = ConversationMessage.MAX_LENGTH) @Schema(requiredMode = REQUIRED) String body,
            @Size(max = 64) String clientId) {
    }

    /** Marks the conversation read up to this message. */
    record ReadRequest(@NotNull @Schema(requiredMode = REQUIRED) UUID messageId) {
    }

    /** The other side: name and address (null once unpublished), small photo. */
    @Schema(name = "ConversationParty")
    record PartyResponse(@Schema(requiredMode = REQUIRED) String name, String slug, String photoUrl) {
    }

    /** {@code mine} = written by the viewer's side; {@code clientId} only on the viewer's own messages. */
    record MessageResponse(
            @Schema(requiredMode = REQUIRED) UUID id,
            @Schema(requiredMode = REQUIRED) UUID conversationId,
            @Schema(requiredMode = REQUIRED) ConversationSide side,
            @Schema(requiredMode = REQUIRED) boolean mine,
            @Schema(requiredMode = REQUIRED) String body,
            @Schema(requiredMode = REQUIRED) Instant createdAt,
            String clientId) {

        static MessageResponse of(MessageView view) {
            return new MessageResponse(view.id(), view.conversationId(), view.side(), view.mine(), view.body(),
                    view.createdAt(), view.clientId());
        }
    }

    /**
     * A conversation for one of its people. {@code bookingId} is set for a booking's thread; {@code lastMessage} is
     * null in a thread nobody wrote in yet. {@code unreadCount} counts the other side's messages the viewer has not
     * read; {@code otherReadUpTo} is the time of the newest message the other side has read (null = none).
     * {@code canWrite} is false while a direct conversation is blocked by either side. {@code bookingStartsAt} is the
     * booking's current start in a booking thread.
     */
    record ConversationResponse(
            @Schema(requiredMode = REQUIRED) UUID id,
            @Schema(requiredMode = REQUIRED) ConversationKind kind,
            UUID bookingId,
            @Schema(requiredMode = REQUIRED) UUID venueId,
            @Schema(requiredMode = REQUIRED) ConversationSide myParty,
            @Schema(requiredMode = REQUIRED) PartyResponse other,
            MessageResponse lastMessage,
            @Schema(requiredMode = REQUIRED) long unreadCount,
            Instant otherReadUpTo,
            @Schema(requiredMode = REQUIRED) boolean blockedByMe,
            @Schema(requiredMode = REQUIRED) boolean blockedByOther,
            @Schema(requiredMode = REQUIRED) boolean canWrite,
            Instant lastMessageAt,
            Instant bookingStartsAt) {

        static ConversationResponse of(ConversationView view) {
            var conversation = view.conversation();
            var blockedBy = conversation.getBlockedBy();
            return new ConversationResponse(conversation.getId(), conversation.getKind(), conversation.getBookingId(),
                    conversation.getVenueId(), view.viewer(),
                    new PartyResponse(view.other().name(), view.other().slug(), view.other().photoUrl()),
                    view.lastMessage() == null ? null : MessageResponse.of(view.lastMessage()), view.unread(),
                    view.otherReadUpTo(), blockedBy == view.viewer(), blockedBy == view.viewer().other(),
                    conversation.isWritable(), conversation.getLastMessageAt(), view.bookingStartsAt());
        }
    }

    /** Newest first; pass the last id as {@code before} for older ones while {@code hasMore}. */
    record MessagePageResponse(
            @Schema(requiredMode = REQUIRED) List<MessageResponse> messages,
            @Schema(requiredMode = REQUIRED) boolean hasMore,
            Instant otherReadUpTo) {

        static MessagePageResponse of(MessagePage page) {
            return new MessagePageResponse(page.messages().stream().map(MessageResponse::of).toList(),
                    page.hasMore(), page.otherReadUpTo());
        }
    }

    /** For the menu: conversations with unread messages, and those messages. */
    @Schema(name = "ConversationUnreadCount")
    record UnreadCountResponse(
            @Schema(requiredMode = REQUIRED) long conversations,
            @Schema(requiredMode = REQUIRED) long messages) {

        static UnreadCountResponse of(UnreadCount count) {
            return new UnreadCountResponse(count.conversations(), count.messages());
        }
    }
}
