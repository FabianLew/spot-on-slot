package pl.spotonslot.identity.domain;

public enum TokenType {
    EMAIL_VERIFICATION,
    PASSWORD_RESET,
    /** Confirms a new e-mail address; the token stores the address it moves the account to. */
    EMAIL_CHANGE
}
