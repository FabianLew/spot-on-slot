package pl.spotonslot.identity;

/** Where an account stands, as admins see it. */
public enum AccountState {
    PENDING_VERIFICATION,
    ACTIVE,
    BLOCKED,
    DELETION_PENDING
}
