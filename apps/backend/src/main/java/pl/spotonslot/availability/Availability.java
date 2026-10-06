package pl.spotonslot.availability;

import java.time.Instant;
import java.util.Collection;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import pl.spotonslot.availability.application.AvailabilityService;

/** The module's facade for other modules (search, booking): free time of artists, and holding it for bookings. */
@Service
@RequiredArgsConstructor
public class Availability {

    private final AvailabilityService availability;

    /** Whether one free slot or rule date of the artist covers the whole of {@code [from, to)}. */
    public boolean isFree(UUID artistId, Instant from, Instant to) {
        return availability.freeAmong(Set.of(artistId), from, to).contains(artistId);
    }

    /** Those of {@code artistIds} that are free for the whole of {@code [from, to)}. */
    public Set<UUID> freeAmong(Collection<UUID> artistIds, Instant from, Instant to) {
        return availability.freeAmong(artistIds, from, to);
    }

    /** Marks the free time covering {@code [from, to)} as booked; fails with {@code AVAILABILITY_NOT_FREE}. */
    public void occupy(UUID artistId, Instant from, Instant to, UUID bookingId) {
        availability.occupy(artistId, from, to, bookingId);
    }

    /** Frees the time held by a booking again (cancelled or declined); unknown bookings are ignored. */
    public void release(UUID bookingId) {
        availability.release(bookingId);
    }
}
