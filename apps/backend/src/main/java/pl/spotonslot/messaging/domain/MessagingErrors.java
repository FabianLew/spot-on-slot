package pl.spotonslot.messaging.domain;

import pl.spotonslot.shared.error.BusinessRuleException;
import pl.spotonslot.shared.error.InvalidRequestException;
import pl.spotonslot.shared.error.NotFoundException;

/** Messaging failures with their problem codes. */
public final class MessagingErrors {

    private MessagingErrors() {
    }

    /** No such conversation, or the caller is neither its artist nor in its venue's team. */
    public static class ConversationNotFound extends NotFoundException {
        public ConversationNotFound() {
            super("MESSAGING_CONVERSATION_NOT_FOUND");
        }
    }

    public static class MessageNotFound extends NotFoundException {
        public MessageNotFound() {
            super("MESSAGING_MESSAGE_NOT_FOUND");
        }
    }

    /** No published profile or venue at that address. */
    public static class RecipientNotFound extends NotFoundException {
        public RecipientNotFound() {
            super("MESSAGING_RECIPIENT_NOT_FOUND");
        }
    }

    /** The venue does not exist or the caller is not in its team. */
    public static class VenueNotFound extends NotFoundException {
        public VenueNotFound() {
            super("MESSAGING_VENUE_NOT_FOUND");
        }
    }

    /** Starting a conversation takes a published profile (artists) or a published venue (venue teams). */
    public static class NotPublished extends BusinessRuleException {
        public NotPublished() {
            super("MESSAGING_NOT_PUBLISHED");
        }
    }

    /** An artist writes to a venue ({@code venueSlug}); a venue team to an artist ({@code venueId}, {@code artistSlug}). */
    public static class RequestInvalid extends InvalidRequestException {
        public RequestInvalid() {
            super("MESSAGING_REQUEST_INVALID");
        }
    }

    /** Too many new conversations today (Polish time); the argument is the limit. */
    public static class LimitReached extends BusinessRuleException {
        public LimitReached(int max) {
            super("MESSAGING_LIMIT", max);
        }
    }

    /** Too many messages within a minute; the argument is the limit. */
    public static class TooFast extends BusinessRuleException {
        public TooFast(int max) {
            super("MESSAGING_RATE", max);
        }
    }

    /** The direct conversation is blocked by one of its sides. */
    public static class Blocked extends BusinessRuleException {
        public Blocked() {
            super("MESSAGING_BLOCKED");
        }
    }

    /** Only direct conversations can be blocked; booking threads stay open. */
    public static class DirectOnly extends InvalidRequestException {
        public DirectOnly() {
            super("MESSAGING_DIRECT_ONLY");
        }
    }
}
