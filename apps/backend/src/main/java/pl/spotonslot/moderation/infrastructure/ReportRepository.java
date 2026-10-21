package pl.spotonslot.moderation.infrastructure;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pl.spotonslot.moderation.domain.Report;
import pl.spotonslot.moderation.domain.ReportKind;
import pl.spotonslot.moderation.domain.ReportStatus;

public interface ReportRepository extends JpaRepository<Report, UUID> {

    long countByReporterIdAndCreatedAtGreaterThanEqual(UUID reporterId, Instant since);

    boolean existsByReporterIdAndKindAndTargetIdAndStatus(UUID reporterId, ReportKind kind, UUID targetId,
            ReportStatus status);

    long countByStatus(ReportStatus status);

    List<Report> findByKindAndTargetIdOrderByCreatedAtDesc(ReportKind kind, UUID targetId);

    List<Report> findByKindAndTargetIdAndStatus(ReportKind kind, UUID targetId, ReportStatus status);

    List<Report> findByReporterIdOrderByCreatedAtDesc(UUID reporterId);

    /** One row per reported thing with open reports, oldest first report first. */
    interface TargetRow {
        String getKind();

        UUID getTargetId();

        String getLabel();

        long getOpenCount();

        Instant getFirstAt();

        Instant getLastAt();

        String getReasons();
    }

    @Query(nativeQuery = true, value = """
            SELECT kind AS kind, target_id AS targetId, (array_agg(label ORDER BY created_at DESC))[1] AS label,
                   count(*) AS openCount, min(created_at) AS firstAt, max(created_at) AS lastAt,
                   string_agg(DISTINCT reason, ',') AS reasons
            FROM moderation_report
            WHERE status = 'OPEN' AND (CAST(:kind AS varchar) IS NULL OR kind = CAST(:kind AS varchar))
            GROUP BY kind, target_id
            ORDER BY min(created_at), target_id""",
            countQuery = """
            SELECT count(DISTINCT (kind, target_id)) FROM moderation_report
            WHERE status = 'OPEN' AND (CAST(:kind AS varchar) IS NULL OR kind = CAST(:kind AS varchar))""")
    Page<TargetRow> findOpenTargets(@Param("kind") String kind, Pageable pageable);

    /** Open reports of things that belonged to the account when reported. */
    @Query(nativeQuery = true, value = "SELECT * FROM moderation_report WHERE status = 'OPEN' AND :userId = ANY(owner_ids)")
    List<Report> findOpenOwnedBy(@Param("userId") UUID userId);

    interface OwnerCount {
        UUID getUserId();

        long getTotal();

        long getOpen();
    }

    /** How many reports (and how many open) concern each of the accounts. */
    @Query(nativeQuery = true, value = """
            SELECT owner AS userId, count(*) AS total, count(*) FILTER (WHERE status = 'OPEN') AS open
            FROM moderation_report, unnest(owner_ids) AS owner
            WHERE owner IN (:userIds)
            GROUP BY owner""")
    List<OwnerCount> countOwnedBy(@Param("userIds") List<UUID> userIds);

    @Modifying
    @Query(nativeQuery = true, value = """
            UPDATE moderation_report SET owner_ids = array_remove(owner_ids, :userId),
                   label = CASE WHEN kind IN ('ARTIST', 'CONVERSATION') AND owner_ids = ARRAY[:userId]::uuid[]
                                THEN :deletedLabel ELSE label END,
                   updated_at = now(), version = version + 1
            WHERE :userId = ANY(owner_ids)""")
    int forgetOwner(@Param("userId") UUID userId, @Param("deletedLabel") String deletedLabel);

    @Modifying
    @Query(nativeQuery = true, value = """
            UPDATE moderation_report SET label = :deletedLabel, updated_at = now(), version = version + 1
            WHERE kind = 'VENUE' AND target_id IN (:venueIds)""")
    int forgetVenues(@Param("venueIds") List<UUID> venueIds, @Param("deletedLabel") String deletedLabel);
}
