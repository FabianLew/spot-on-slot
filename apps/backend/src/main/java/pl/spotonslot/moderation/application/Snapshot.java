package pl.spotonslot.moderation.application;

import java.util.List;
import pl.spotonslot.messaging.ConversationReport;

/** The copy of a reported conversation, stored as JSON in the report. */
public record Snapshot(List<ConversationReport.Message> messages) {
}
