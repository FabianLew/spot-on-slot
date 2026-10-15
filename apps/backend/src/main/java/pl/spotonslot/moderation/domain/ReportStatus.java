package pl.spotonslot.moderation.domain;

/** OPEN until an admin acts on the reported thing (RESOLVED) or finds nothing wrong (DISMISSED). */
public enum ReportStatus {
    OPEN,
    RESOLVED,
    DISMISSED
}
