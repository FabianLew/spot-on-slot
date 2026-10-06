package pl.spotonslot.location.infrastructure;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pl.spotonslot.location.SubjectType;
import pl.spotonslot.location.domain.Location;

public interface LocationRepository extends JpaRepository<Location, UUID> {

    Optional<Location> findBySubjectTypeAndSubjectId(SubjectType subjectType, UUID subjectId);

    @Modifying
    @Query("DELETE FROM Location l WHERE l.subjectType = :subjectType AND l.subjectId = :subjectId")
    int deleteBySubject(@Param("subjectType") SubjectType subjectType, @Param("subjectId") UUID subjectId);

    /** Subjects of one type within {@code meters} of the point, nearest first. Uses the GIST index on {@code point}. */
    @Query(nativeQuery = true, value = """
            SELECT l.subject_id AS subjectId, l.latitude AS latitude, l.longitude AS longitude, l.city AS city,
                   ST_Distance(l.point, ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography) AS distance
            FROM location l
            WHERE l.subject_type = :subjectType
              AND ST_DWithin(l.point, ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography, :meters)
            ORDER BY distance, l.subject_id
            LIMIT :limit
            """)
    List<NearbyRow> findWithin(@Param("subjectType") String subjectType, @Param("latitude") double latitude,
            @Param("longitude") double longitude, @Param("meters") double meters, @Param("limit") int limit);

    interface NearbyRow {
        UUID getSubjectId();

        double getLatitude();

        double getLongitude();

        String getCity();

        double getDistance();
    }
}
