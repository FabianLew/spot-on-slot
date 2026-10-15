package pl.spotonslot.moderation.domain;

/** What an admin did. */
public enum ActionType {
    BLOCK_ACCOUNT,
    UNBLOCK_ACCOUNT,
    HIDE,
    RESTORE,
    CLOSE_LISTING,
    DISMISS_REPORTS,
    ADD_ADMIN
}
