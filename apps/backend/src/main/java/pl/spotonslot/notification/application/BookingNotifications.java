package pl.spotonslot.notification.application;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import pl.spotonslot.booking.BookingAccepted;
import pl.spotonslot.booking.BookingCancelled;
import pl.spotonslot.booking.BookingCountered;
import pl.spotonslot.booking.BookingDeclined;
import pl.spotonslot.booking.BookingExpired;
import pl.spotonslot.booking.BookingParty;
import pl.spotonslot.booking.BookingRequested;
import pl.spotonslot.booking.BookingWithdrawn;
import pl.spotonslot.booking.Bookings;
import pl.spotonslot.notification.NotificationCreated;
import pl.spotonslot.notification.domain.BookingUpdate;
import pl.spotonslot.notification.domain.BookingUpdate.Kind;
import pl.spotonslot.notification.domain.Notification;
import pl.spotonslot.notification.infrastructure.NotificationRepository;
import pl.spotonslot.venue.Venues;

/**
 * Tells the other side of a booking about each step: the artist when the venue acted, the venue's whole team when the
 * artist did, both sides when the system did (expiry); a step the system declined because the artist got booked then
 * goes to the venue. The person who acted is never told. Each event is handled in one transaction, so a retry after a
 * failure starts clean.
 */
@Slf4j
@Component
@RequiredArgsConstructor
class BookingNotifications {

    private final Bookings bookings;
    private final Venues venues;
    private final NotificationRepository notifications;
    private final NotificationPayloads payloads;
    private final ApplicationEventPublisher events;

    @ApplicationModuleListener
    void on(BookingRequested event) {
        tell(Kind.REQUESTED, event.bookingId(), event.artistId(), event.venueId(), event.startsAt(), event.endsAt(),
                event.by(), event.actorId());
    }

    @ApplicationModuleListener
    void on(BookingCountered event) {
        tell(Kind.COUNTERED, event.bookingId(), event.artistId(), event.venueId(), event.startsAt(), event.endsAt(),
                event.by(), event.actorId());
    }

    @ApplicationModuleListener
    void on(BookingAccepted event) {
        tell(Kind.ACCEPTED, event.bookingId(), event.artistId(), event.venueId(), event.startsAt(), event.endsAt(),
                event.by(), event.actorId());
    }

    @ApplicationModuleListener
    void on(BookingDeclined event) {
        tell(Kind.DECLINED, event.bookingId(), event.artistId(), event.venueId(), event.startsAt(), event.endsAt(),
                event.by(), event.actorId());
    }

    @ApplicationModuleListener
    void on(BookingWithdrawn event) {
        tell(Kind.WITHDRAWN, event.bookingId(), event.artistId(), event.venueId(), event.startsAt(), event.endsAt(),
                event.by(), event.actorId());
    }

    @ApplicationModuleListener
    void on(BookingCancelled event) {
        tell(Kind.CANCELLED, event.bookingId(), event.artistId(), event.venueId(), event.startsAt(), event.endsAt(),
                event.by(), event.actorId());
    }

    @ApplicationModuleListener
    void on(BookingExpired event) {
        tell(Kind.EXPIRED, event.bookingId(), event.artistId(), event.venueId(), event.startsAt(), event.endsAt(),
                event.by(), event.actorId());
    }

    private void tell(Kind kind, UUID bookingId, UUID artistId, UUID venueId, Instant startsAt, Instant endsAt,
            BookingParty by, UUID actorId) {
        var booking = bookings.find(bookingId).orElse(null);
        if (booking == null) {
            return;
        }
        var toArtist = by != BookingParty.ARTIST && !(kind == Kind.DECLINED && by == BookingParty.SYSTEM);
        var toVenue = by != BookingParty.VENUE;
        var recipients = new LinkedHashSet<UUID>();
        if (toArtist) {
            recipients.add(artistId);
        }
        if (toVenue) {
            recipients.addAll(venues.teamsOf(Set.of(venueId)).getOrDefault(venueId, Set.of()));
        }
        if (actorId != null) {
            recipients.remove(actorId);
        }
        for (var recipient : recipients) {
            var artist = recipient.equals(artistId);
            var update = new BookingUpdate(bookingId, kind, artist ? BookingParty.ARTIST : BookingParty.VENUE, by,
                    artist ? booking.venueName() : booking.artistStageName(), startsAt, endsAt, booking.amount());
            var notification = notifications.save(Notification.booking(recipient, bookingId, payloads.write(update)));
            events.publishEvent(new NotificationCreated(notification.getId(), recipient, notification.getType()));
        }
        log.info("Booking {} {}: told {} people", bookingId, kind, recipients.size());
    }
}
