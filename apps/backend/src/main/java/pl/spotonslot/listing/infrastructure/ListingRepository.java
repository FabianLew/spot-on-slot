package pl.spotonslot.listing.infrastructure;

import java.time.Instant;
import java.util.Collection;
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

    /** Listings of the ids, genres loaded. */
    @Query("SELECT DISTINCT l FROM Listing l LEFT JOIN FETCH l.genres WHERE l.id IN :ids")
    List<Listing> findWithGenresByIdIn(@Param("ids") Collection<UUID> ids);

    /**
     * Active listings that have not started within {@code meters} of the point, nearest first; see
     * {@code ListingSearch} for the filters ({@code any*} switch one off; its value must still be non-null, and
     * {@code genres} non-empty). Uses the GIST index on {@code point}.
     */
    @Query(nativeQuery = true, value = """
            SELECT l.id AS id,
                   ST_Distance(l.point, ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography) AS distance
            FROM listing l
            WHERE l.status = 'ACTIVE' AND l.starts_at > :now
              AND ST_DWithin(l.point, ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography, :meters)
              AND (CAST(:anyKind AS boolean) OR l.kind = :kind)
              AND (CAST(:anyTime AS boolean) OR (l.starts_at < :to AND l.ends_at > :from))
              AND (CAST(:anyGenre AS boolean)
                   OR EXISTS (SELECT 1 FROM listing_genre g WHERE g.listing_id = l.id AND g.genre IN (:genres)))
              AND (CAST(:anyBudget AS boolean)
                   OR (l.kind = 'VENUE_SEEKING' AND COALESCE(l.price_to, l.price_from, :budget) >= :budget)
                   OR (l.kind = 'ARTIST_AVAILABLE' AND COALESCE(l.price_from, l.price_to, :budget) <= :budget))
            ORDER BY distance, l.starts_at, l.id
            LIMIT :limit
            """)
    List<NearbyRow> findActiveWithin(@Param("latitude") double latitude, @Param("longitude") double longitude,
            @Param("meters") double meters, @Param("now") Instant now, @Param("anyKind") boolean anyKind,
            @Param("kind") String kind, @Param("anyTime") boolean anyTime, @Param("from") Instant from,
            @Param("to") Instant to, @Param("anyGenre") boolean anyGenre, @Param("genres") Collection<String> genres,
            @Param("anyBudget") boolean anyBudget, @Param("budget") long budget, @Param("limit") int limit);

    interface NearbyRow {
        UUID getId();

        double getDistance();
    }

    /** Listings the person posted or that are theirs as the artist, newest first. */
    @Query("SELECT l FROM Listing l WHERE l.authorId = :userId OR l.artistId = :userId ORDER BY l.createdAt DESC")
    List<Listing> findOfPerson(@Param("userId") UUID userId);

    /** Active listings the person posted, theirs as the artist, or of the venues. */
    @Query("SELECT l FROM Listing l WHERE l.status = pl.spotonslot.listing.domain.ListingStatus.ACTIVE"
            + " AND (l.authorId = :userId OR l.artistId = :userId OR l.venueId IN :venueIds)")
    List<Listing> findActiveOfPersonOrVenues(@Param("userId") UUID userId,
            @Param("venueIds") Collection<UUID> venueIds);

    /** Genres go with the listings (the foreign key cascades). */
    @Modifying
    @Query("DELETE FROM Listing l WHERE l.authorId = :userId OR l.artistId = :userId")
    int deleteOfPerson(@Param("userId") UUID userId);

    @Modifying
    @Query("DELETE FROM Listing l WHERE l.venueId IN :venueIds")
    int deleteOfVenues(@Param("venueIds") Collection<UUID> venueIds);

    /** Stores the expiry of active listings that have started; returns how many. */
    @Modifying
    @Query("UPDATE Listing l SET l.status = :expired, l.closedAt = :now, l.updatedAt = :now, l.version = l.version + 1"
            + " WHERE l.status = :active AND l.startsAt <= :now")
    int expireStarted(@Param("now") Instant now, @Param("active") ListingStatus active,
            @Param("expired") ListingStatus expired);
}
