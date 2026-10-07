package pl.spotonslot.booking;

/**
 * Where a booking stands. A pending booking unanswered for 72 hours or whose time has started reads as
 * {@code EXPIRED}, an accepted one whose time has ended as {@code COMPLETED}, before the job stores it.
 */
public enum BookingStatus {
    PENDING,
    ACCEPTED,
    DECLINED,
    WITHDRAWN,
    CANCELLED,
    EXPIRED,
    COMPLETED
}
