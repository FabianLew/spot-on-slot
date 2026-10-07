package pl.spotonslot.messaging.application;

import java.util.Collection;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import pl.spotonslot.booking.BookingConversations;
import pl.spotonslot.booking.BookingRequested;

/** Opens a thread for every booking as soon as it is requested, and tells the booking module which one it is. */
@Component
@RequiredArgsConstructor
class BookingThreads implements BookingConversations {

    private final ConversationService conversations;

    @ApplicationModuleListener
    void on(BookingRequested event) {
        conversations.openBookingThread(event.bookingId());
    }

    @Override
    public Map<UUID, UUID> conversationsOf(Collection<UUID> bookingIds) {
        return conversations.bookingThreads(bookingIds);
    }
}
