package pl.spotonslot.moderation.domain;

/** Why something is reported; {@code OTHER} needs a description. */
public enum ReportReason {
    SPAM,
    FRAUD,
    OFFENSIVE,
    IMPERSONATION,
    MISLEADING,
    OTHER
}
