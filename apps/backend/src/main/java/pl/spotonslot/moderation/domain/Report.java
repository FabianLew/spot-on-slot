package pl.spotonslot.moderation.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.ColumnTransformer;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import pl.spotonslot.shared.persistence.BaseEntity;

/**
 * One person's report of one thing. {@code ownerIds} and {@code label} are who the thing belonged to and what it was
 * called when reported; {@code snapshot} (JSON) the copy of a reported conversation.
 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "moderation_report")
public class Report extends BaseEntity {

    /** Null once the reporter's account was purged. */
    @Column(name = "reporter_id")
    private UUID reporterId;

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false, updatable = false, length = 16)
    private ReportKind kind;

    @Column(name = "target_id", nullable = false, updatable = false)
    private UUID targetId;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "owner_ids", nullable = false, columnDefinition = "uuid[]")
    private UUID[] ownerIds;

    @Column(name = "label", nullable = false, length = 120)
    private String label;

    @Enumerated(EnumType.STRING)
    @Column(name = "reason", nullable = false, updatable = false, length = 24)
    private ReportReason reason;

    @Column(name = "description", length = 1000)
    private String description;

    @ColumnTransformer(write = "?::jsonb")
    @Column(name = "snapshot", columnDefinition = "jsonb")
    private String snapshot;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private ReportStatus status;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @Column(name = "resolved_by")
    private UUID resolvedBy;

    @Column(name = "resolution_note", length = 500)
    private String resolutionNote;

    public static Report open(UUID reporterId, ReportKind kind, UUID targetId, Set<UUID> ownerIds, String label,
            ReportReason reason, String description, String snapshot) {
        var report = new Report();
        report.reporterId = reporterId;
        report.kind = kind;
        report.targetId = targetId;
        report.ownerIds = ownerIds.toArray(UUID[]::new);
        report.label = label.length() > 120 ? label.substring(0, 120) : label;
        report.reason = reason;
        report.description = description;
        report.snapshot = snapshot;
        report.status = ReportStatus.OPEN;
        return report;
    }

    public Set<UUID> owners() {
        return Set.of(ownerIds);
    }

    /** Closes an open report; one already closed keeps how it was closed. */
    public boolean close(ReportStatus outcome, UUID adminId, String note, Instant now) {
        if (status != ReportStatus.OPEN) {
            return false;
        }
        status = outcome;
        resolvedBy = adminId;
        resolutionNote = note;
        resolvedAt = now;
        return true;
    }

    /** After the reporter's account was purged: the report stays, without them and their side of the copy. */
    public void forgetReporter(String snapshotWithoutReporter) {
        reporterId = null;
        snapshot = snapshotWithoutReporter;
    }
}
