package pl.spotonslot.identity.domain;

import org.springframework.http.HttpStatus;
import pl.spotonslot.shared.error.BusinessRuleException;
import pl.spotonslot.shared.error.ConflictException;
import pl.spotonslot.shared.error.DomainException;
import pl.spotonslot.shared.error.ForbiddenException;
import pl.spotonslot.shared.error.InvalidFieldException;
import pl.spotonslot.shared.error.InvalidRequestException;
import pl.spotonslot.shared.error.NotFoundException;
import pl.spotonslot.shared.error.TooManyRequestsException;

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

    /** The current password given to confirm an account change is wrong; reported at {@code field}. */
    public static class WrongPassword extends InvalidFieldException {
        public WrongPassword(String field) {
            super("IDENTITY_WRONG_PASSWORD", field);
        }
    }

    /** Too many wrong passwords in account changes within the window. */
    public static class TooManyAttempts extends TooManyRequestsException {
        public TooManyAttempts() {
            super("ACCOUNT_TOO_MANY_ATTEMPTS");
        }
    }

    /** The new e-mail address is the current one. */
    public static class EmailUnchanged extends InvalidFieldException {
        public EmailUnchanged() {
            super("IDENTITY_EMAIL_UNCHANGED", "newEmail");
        }
    }

    /** Another account took the address between the request and its confirmation. */
    public static class EmailTaken extends ConflictException {
        public EmailTaken() {
            super("IDENTITY_EMAIL_TAKEN");
        }
    }

    /** The data export was downloaded less than a minute ago. */
    public static class ExportTooSoon extends TooManyRequestsException {
        public ExportTooSoon() {
            super("ACCOUNT_EXPORT_TOO_SOON");
        }
    }

    /** The account waits for deletion: only restoring it and signing out work. */
    public static class DeletionPending extends ForbiddenException {
        public DeletionPending() {
            super("ACCOUNT_DELETION_PENDING");
        }
    }

    /** The account is the last owner of venues whose team has other people; {@code names} lists them. */
    public static class LastVenueOwner extends ConflictException {
        public LastVenueOwner(String names) {
            super("ACCOUNT_LAST_VENUE_OWNER", names);
        }
    }

    /** An admin action names an account that does not exist. */
    public static class AdminAccountNotFound extends NotFoundException {
        public AdminAccountNotFound() {
            super("ADMIN_ACCOUNT_NOT_FOUND");
        }
    }

    /** Admins cannot block themselves. */
    public static class CannotBlockSelf extends BusinessRuleException {
        public CannotBlockSelf() {
            super("ADMIN_CANNOT_BLOCK_SELF");
        }
    }

    /** The last active admin cannot be blocked: nobody could unblock anyone afterwards. */
    public static class LastAdmin extends BusinessRuleException {
        public LastAdmin() {
            super("ADMIN_LAST_ADMIN");
        }
    }

    /** An account waiting for deletion is already hidden and will be purged; it is not blocked. */
    public static class BlockDeletionPending extends BusinessRuleException {
        public BlockDeletionPending() {
            super("ADMIN_ACCOUNT_DELETION_PENDING");
        }
    }

    /** A new admin needs an address without an account (artist and venue accounts do not become admins). */
    public static class AdminEmailTaken extends ConflictException {
        public AdminEmailTaken() {
            super("ADMIN_EMAIL_TAKEN");
        }
    }
}
