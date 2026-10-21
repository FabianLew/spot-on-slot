package pl.spotonslot.moderation.infrastructure;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pl.spotonslot.moderation.domain.ModerationAction;
import pl.spotonslot.moderation.domain.ReportKind;

public interface ModerationActionRepository extends JpaRepository<ModerationAction, UUID> {

    Page<ModerationAction> findAllByOrderByCreatedAtDescIdDesc(Pageable pageable);

    List<ModerationAction> findByKindAndTargetIdOrderByCreatedAtDescIdDesc(ReportKind kind, UUID targetId);

    /** Actions about the account itself or about its profile and venues ({@code targetIds}). */
    @Query("""
            SELECT a FROM ModerationAction a WHERE a.subjectId = :userId OR a.targetId IN :targetIds
            ORDER BY a.createdAt DESC, a.id DESC""")
    List<ModerationAction> findAbout(@Param("userId") UUID userId, @Param("targetIds") Collection<UUID> targetIds);

    @Modifying
    @Query(nativeQuery = true, value = """
            UPDATE moderation_action SET subject_label = :deletedLabel, subject_id = NULL,
                   updated_at = now(), version = version + 1
            WHERE subject_id = :userId""")
    int forgetSubject(@Param("userId") UUID userId, @Param("deletedLabel") String deletedLabel);

    @Modifying
    @Query(nativeQuery = true, value = """
            UPDATE moderation_action SET subject_label = :deletedLabel, updated_at = now(), version = version + 1
            WHERE kind = 'VENUE' AND target_id IN (:venueIds)""")
    int forgetVenues(@Param("venueIds") List<UUID> venueIds, @Param("deletedLabel") String deletedLabel);

    @Modifying
    @Query(nativeQuery = true, value = """
            UPDATE moderation_action SET admin_email = :deletedLabel, updated_at = now(), version = version + 1
            WHERE admin_id = :userId""")
    int forgetAdmin(@Param("userId") UUID userId, @Param("deletedLabel") String deletedLabel);
}
