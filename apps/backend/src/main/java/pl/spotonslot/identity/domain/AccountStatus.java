package pl.spotonslot.identity.domain;

public enum AccountStatus {
    PENDING_VERIFICATION,
    ACTIVE,
    BLOCKED,
    /** The owner asked to delete the account; it is purged after the grace period unless restored. */
    DELETION_PENDING
}
