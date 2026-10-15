package pl.spotonslot.moderation.application;

import java.util.UUID;
import pl.spotonslot.moderation.domain.ReportKind;

/** What a person reports: ARTIST and VENUE by public {@code slug}, LISTING and CONVERSATION by {@code id}. */
public record ReportTarget(ReportKind kind, String slug, UUID id) {
}
