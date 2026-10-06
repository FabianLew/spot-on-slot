package pl.spotonslot.listing.infrastructure;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pl.spotonslot.listing.domain.Listing;
import pl.spotonslot.listing.domain.ListingStatus;

public interface ListingRepository extends JpaRepository<Listing, UUID>, JpaSpecificationExecutor<Listing> {

    /** Active listings of the artist that have not started. */
    @Query("SELECT l FROM Listing l WHERE l.artistId = :artistId AND l.status = pl.spotonslot.listing.domain.ListingStatus.ACTIVE AND l.startsAt > :now")
    List<Listing> findUpcomingOfArtist(@Param("artistId") UUID artistId, @Param("now") Instant now);

    @Query("SELECT count(l) FROM Listing l WHERE l.artistId = :artistId AND l.status = pl.spotonslot.listing.domain.ListingStatus.ACTIVE AND l.startsAt > :now")
    long countUpcomingOfArtist(@Param("artistId") UUID artistId, @Param("now") Instant now);

    @Query("SELECT count(l) FROM Listing l WHERE l.venueId = :venueId AND l.status = pl.spotonslot.listing.domain.ListingStatus.ACTIVE AND l.startsAt > :now")
    long countUpcomingOfVenue(@Param("venueId") UUID venueId, @Param("now") Instant now);

    /** Stores the expiry of active listings that have started; returns how many. */
    @Modifying
    @Query("UPDATE Listing l SET l.status = :expired, l.closedAt = :now, l.updatedAt = :now, l.version = l.version + 1"
            + " WHERE l.status = :active AND l.startsAt <= :now")
    int expireStarted(@Param("now") Instant now, @Param("active") ListingStatus active,
            @Param("expired") ListingStatus expired);
}
