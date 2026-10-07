package pl.spotonslot.booking.domain;

import java.time.Instant;

/** One proposal: the time, the fee in grosze and an optional message. */
public record BookingTerms(Instant startsAt, Instant endsAt, long amount, String message) {
}
