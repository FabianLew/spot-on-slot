package pl.spotonslot.venue.infrastructure;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pl.spotonslot.venue.domain.Venue;

public interface VenueRepository extends JpaRepository<Venue, UUID> {

    Optional<Venue> findBySlug(String slug);

    boolean existsBySlug(String slug);

    List<Venue> findByIdIn(Collection<UUID> ids);

    /** Published venues of the ids, genres loaded. */
    @Query("SELECT DISTINCT v FROM Venue v LEFT JOIN FETCH v.genres WHERE v.id IN :ids AND v.publishedAt IS NOT NULL")
    List<Venue> findPublishedByIdIn(@Param("ids") Collection<UUID> ids);

    /**
     * Published venues within {@code meters} of the point, nearest first, optionally of some types and with any of
     * some genres ({@code anyType}/{@code anyGenre} switch a filter off; its list must still be non-empty). Uses the
     * GIST index on {@code point}.
     */
    @Query(nativeQuery = true, value = """
            SELECT v.id AS id,
                   ST_Distance(v.point, ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography) AS distance
            FROM venue v
            WHERE v.published_at IS NOT NULL
              AND ST_DWithin(v.point, ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography, :meters)
              AND (CAST(:anyType AS boolean) OR v.type IN (:types))
              AND (CAST(:anyGenre AS boolean)
                   OR EXISTS (SELECT 1 FROM venue_genre g WHERE g.venue_id = v.id AND g.genre IN (:genres)))
            ORDER BY distance, v.name, v.id
            LIMIT :limit
            """)
    List<NearbyRow> findPublishedWithin(@Param("latitude") double latitude, @Param("longitude") double longitude,
            @Param("meters") double meters, @Param("anyType") boolean anyType, @Param("types") Collection<String> types,
            @Param("anyGenre") boolean anyGenre, @Param("genres") Collection<String> genres, @Param("limit") int limit);

    interface NearbyRow {
        UUID getId();

        double getDistance();
    }

    @Query("SELECT DISTINCT v FROM Venue v LEFT JOIN v.photoMediaIds photo"
            + " WHERE v.avatarMediaId = :mediaId OR photo = :mediaId")
    List<Venue> findUsingMedia(@Param("mediaId") UUID mediaId);
}
