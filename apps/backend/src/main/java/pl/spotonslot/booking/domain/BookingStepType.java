package pl.spotonslot.booking.domain;

/** What happened in one step of a booking's history. */
public enum BookingStepType {
    REQUESTED,
    COUNTERED,
    ACCEPTED,
    DECLINED,
    WITHDRAWN,
    CANCELLED,
    EXPIRED,
    COMPLETED
}
