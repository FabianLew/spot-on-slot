package pl.spotonslot.moderation.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import pl.spotonslot.shared.persistence.BaseEntity;

/**
 * One thing an admin did, never edited (only anonymized after a purge). {@code kind}/{@code targetId}: the profile,
 * venue, listing or conversation acted on; {@code subjectId}/{@code subjectLabel}: the account concerned, or the
 * thing's name when no single account is.
 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "moderation_action")
public class ModerationAction extends BaseEntity {

    @Column(name = "admin_id", nullable = false, updatable = false)
    private UUID adminId;

    @Column(name = "admin_email", nullable = false, updatable = false, length = 254)
    private String adminEmail;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, updatable = false, length = 24)
    private ActionType type;

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", updatable = false, length = 16)
    private ReportKind kind;

    @Column(name = "target_id", updatable = false)
    private UUID targetId;

    @Column(name = "subject_id", updatable = false)
    private UUID subjectId;

    @Column(name = "subject_label", nullable = false, updatable = false, length = 254)
    private String subjectLabel;

    @Column(name = "reason", updatable = false, length = 500)
    private String reason;

    public static ModerationAction of(UUID adminId, String adminEmail, ActionType type, ReportKind kind,
            UUID targetId, UUID subjectId, String subjectLabel, String reason) {
        var action = new ModerationAction();
        action.adminId = adminId;
        action.adminEmail = adminEmail;
        action.type = type;
        action.kind = kind;
        action.targetId = targetId;
        action.subjectId = subjectId;
        action.subjectLabel = subjectLabel.length() > 254 ? subjectLabel.substring(0, 254) : subjectLabel;
        action.reason = reason;
        return action;
    }
}
