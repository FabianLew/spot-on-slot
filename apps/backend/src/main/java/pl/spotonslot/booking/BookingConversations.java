package pl.spotonslot.booking;

import java.util.Collection;
import java.util.Map;
import java.util.UUID;

/**
 * The conversation threads of bookings, provided by the messaging module (which depends on booking, not the other
 * way round), so a booking can link to its thread.
 */
public interface BookingConversations {

    /** The thread of each of the bookings that has one. */
    Map<UUID, UUID> conversationsOf(Collection<UUID> bookingIds);
}
