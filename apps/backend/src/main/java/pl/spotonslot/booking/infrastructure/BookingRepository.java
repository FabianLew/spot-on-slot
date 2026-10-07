package pl.spotonslot.booking.infrastructure;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pl.spotonslot.booking.domain.Booking;

public interface BookingRepository extends JpaRepository<Booking, UUID>, JpaSpecificationExecutor<Booking> {

    /** The artist of a booking, read before taking the artist's lock (the booking is then read afresh). */
    @Query("SELECT b.artistId FROM Booking b WHERE b.id = :id")
    Optional<UUID> findArtistId(@Param("id") UUID id);

    /** The artist's bookings still pending as of {@code now} that overlap {@code [from, to)}. */
    @Query("SELECT b FROM Booking b WHERE b.artistId = :artistId"
            + " AND b.status = pl.spotonslot.booking.BookingStatus.PENDING"
            + " AND b.respondBy > :now AND b.startsAt > :now AND b.startsAt < :to AND b.endsAt > :from")
    List<Booking> findPendingOfArtistBetween(@Param("artistId") UUID artistId, @Param("from") Instant from,
            @Param("to") Instant to, @Param("now") Instant now);

    @Query("SELECT count(b) FROM Booking b WHERE b.venueId = :venueId"
            + " AND b.status = pl.spotonslot.booking.BookingStatus.PENDING AND b.respondBy > :now AND b.startsAt > :now")
    long countPendingOfVenue(@Param("venueId") UUID venueId, @Param("now") Instant now);

    @Query("SELECT count(b) FROM Booking b WHERE b.artistId = :artistId"
            + " AND b.initiator = pl.spotonslot.booking.BookingParty.ARTIST"
            + " AND b.status = pl.spotonslot.booking.BookingStatus.PENDING AND b.respondBy > :now AND b.startsAt > :now")
    long countPendingApplicationsOfArtist(@Param("artistId") UUID artistId, @Param("now") Instant now);

    @Query("SELECT count(b) > 0 FROM Booking b WHERE b.venueId = :venueId"
            + " AND b.status = pl.spotonslot.booking.BookingStatus.ACCEPTED AND b.startsAt < :to AND b.endsAt > :from")
    boolean existsAcceptedOfVenueBetween(@Param("venueId") UUID venueId, @Param("from") Instant from,
            @Param("to") Instant to);

    /**
     * Ids of the bookings of the artist or of the venues that may still be open as of {@code now}: pending ones and
     * accepted ones that have not started.
     */
    @Query("SELECT b.id FROM Booking b WHERE (b.artistId = :userId OR b.venueId IN :venueIds)"
            + " AND ((b.status = pl.spotonslot.booking.BookingStatus.PENDING AND b.respondBy > :now"
            + " AND b.startsAt > :now)"
            + " OR (b.status = pl.spotonslot.booking.BookingStatus.ACCEPTED AND b.startsAt > :now))")
    List<UUID> findOpenOfArtistOrVenues(@Param("userId") UUID userId,
            @Param("venueIds") java.util.Collection<UUID> venueIds, @Param("now") Instant now);

    /** Pending bookings past their answer window or start, and accepted ones past their end. */
    @Query("SELECT b FROM Booking b WHERE (b.status = pl.spotonslot.booking.BookingStatus.PENDING"
            + " AND (b.respondBy <= :now OR b.startsAt <= :now))"
            + " OR (b.status = pl.spotonslot.booking.BookingStatus.ACCEPTED AND b.endsAt <= :now)")
    List<Booking> findTimedOut(@Param("now") Instant now);
}
