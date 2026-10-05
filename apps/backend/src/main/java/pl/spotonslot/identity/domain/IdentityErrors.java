package pl.spotonslot.identity.domain;

import org.springframework.http.HttpStatus;
import pl.spotonslot.shared.error.DomainException;
import pl.spotonslot.shared.error.InvalidRequestException;

/** Identity failures with their problem codes. */
public final class IdentityErrors {

    private IdentityErrors() {
    }

    /** Unknown e-mail or wrong password: one answer for both, so login does not reveal which addresses exist. */
    public static class InvalidCredentials extends DomainException {
        public InvalidCredentials() {
            super("IDENTITY_INVALID_CREDENTIALS", HttpStatus.UNAUTHORIZED);
        }
    }

    public static class EmailNotVerified extends DomainException {
        public EmailNotVerified() {
            super("IDENTITY_EMAIL_NOT_VERIFIED", HttpStatus.FORBIDDEN);
        }
    }

    public static class AccountBlocked extends DomainException {
        public AccountBlocked() {
            super("IDENTITY_ACCOUNT_BLOCKED", HttpStatus.FORBIDDEN);
        }
    }

    /** Missing, unknown, used or expired refresh token: the client has to log in again. */
    public static class RefreshInvalid extends DomainException {
        public RefreshInvalid() {
            super("IDENTITY_REFRESH_INVALID", HttpStatus.UNAUTHORIZED);
        }
    }

    /** Unknown, used or expired e-mail link. */
    public static class TokenInvalid extends InvalidRequestException {
        public TokenInvalid() {
            super("IDENTITY_TOKEN_INVALID");
        }
    }

    /** The new password equals the account's e-mail address. */
    public static class PasswordEqualsEmail extends InvalidRequestException {
        public PasswordEqualsEmail() {
            super("IDENTITY_PASSWORD_EQUALS_EMAIL");
        }
    }
}
