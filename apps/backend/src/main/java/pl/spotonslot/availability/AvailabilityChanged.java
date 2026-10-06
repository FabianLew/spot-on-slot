package pl.spotonslot.availability;

import java.util.UUID;

/** Free time of an artist may have shrunk: a slot or rule was changed or removed, a date skipped or booked. */
public record AvailabilityChanged(UUID artistId) {
}
