package pl.spotonslot.identity.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import pl.spotonslot.identity.Role;
import pl.spotonslot.shared.persistence.BaseEntity;

/**
 * A login account. It starts {@link AccountStatus#PENDING_VERIFICATION} and becomes {@link AccountStatus#ACTIVE}
 * once the e-mail address is verified. The e-mail is stored lowercased.
 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "identity_user")
public class UserAccount extends BaseEntity {

    @Column(name = "email", nullable = false, length = 254)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 16)
    private Role role;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 24)
    private AccountStatus status;

    @Column(name = "locale", nullable = false, length = 2)
    private String locale;

    @Column(name = "privacy_notice_accepted_at", nullable = false, updatable = false)
    private Instant privacyNoticeAcceptedAt;

    @Column(name = "terms_accepted_at")
    private Instant termsAcceptedAt;

    @Column(name = "terms_version", length = 32)
    private String termsVersion;

    @Column(name = "email_verified_at")
    private Instant emailVerifiedAt;

    /** When the owner asked to delete the account; set while {@link AccountStatus#DELETION_PENDING}. */
    @Column(name = "deletion_requested_at")
    private Instant deletionRequestedAt;

    /** When an admin blocked the account; set while {@link AccountStatus#BLOCKED}. */
    @Column(name = "blocked_at")
    private Instant blockedAt;

    @Column(name = "block_reason", length = 500)
    private String blockReason;

    public static UserAccount register(String email, String passwordHash, Role role, String locale, String termsVersion,
            Instant now) {
        var account = new UserAccount();
        account.email = email;
        account.passwordHash = passwordHash;
        account.role = role;
        account.locale = locale;
        account.status = AccountStatus.PENDING_VERIFICATION;
        account.privacyNoticeAcceptedAt = now;
        account.termsAcceptedAt = now;
        account.termsVersion = termsVersion;
        return account;
    }

    /**
     * An admin account invited by another admin: it signs in once its owner sets a password through the link, which
     * also verifies the address. {@code passwordHash} is of a random password nobody knows.
     */
    public static UserAccount invitedAdmin(String email, String passwordHash, String locale, String termsVersion,
            Instant now) {
        return register(email, passwordHash, Role.ADMIN, locale, termsVersion, now);
    }

    /** The first admin from the deployment's configuration, verified at once. */
    public static UserAccount bootstrapAdmin(String email, String passwordHash, String termsVersion, Instant now) {
        var account = register(email, passwordHash, Role.ADMIN, "pl", termsVersion, now);
        account.verifyEmail(now);
        return account;
    }

    /** Marks the e-mail address as verified; a blocked account stays blocked. */
    public void verifyEmail(Instant now) {
        if (emailVerifiedAt == null) {
            emailVerifiedAt = now;
        }
        if (status == AccountStatus.PENDING_VERIFICATION) {
            status = AccountStatus.ACTIVE;
        }
    }

    public void changePassword(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    /** {@code email} is already normalized and checked to be free. */
    public void changeEmail(String email) {
        this.email = email;
    }

    public void acceptTerms(String version, Instant now) {
        this.termsVersion = version;
        this.termsAcceptedAt = now;
    }

    public boolean hasAcceptedTerms(String currentVersion) {
        return currentVersion.equals(termsVersion);
    }

    /** Starts the grace period after which the account is purged; sessions are ended by the caller. */
    public void requestDeletion(Instant now) {
        status = AccountStatus.DELETION_PENDING;
        deletionRequestedAt = now;
    }

    /** Takes back a deletion request; does nothing for an account that is not pending deletion. */
    public boolean restore() {
        if (status != AccountStatus.DELETION_PENDING) {
            return false;
        }
        status = AccountStatus.ACTIVE;
        deletionRequestedAt = null;
        return true;
    }

    /** Blocks the account; sessions are ended by the caller. An account waiting for deletion is never blocked. */
    public void block(String reason, Instant now) {
        status = AccountStatus.BLOCKED;
        blockedAt = now;
        blockReason = reason;
    }

    /** Lifts a block: back to active, or to waiting for verification if the address was never confirmed. */
    public boolean unblock() {
        if (status != AccountStatus.BLOCKED) {
            return false;
        }
        status = emailVerifiedAt != null ? AccountStatus.ACTIVE : AccountStatus.PENDING_VERIFICATION;
        blockedAt = null;
        blockReason = null;
        return true;
    }

    public boolean isBlocked() {
        return status == AccountStatus.BLOCKED;
    }

    public boolean isDeletionPending() {
        return status == AccountStatus.DELETION_PENDING;
    }

    public boolean isPendingVerification() {
        return status == AccountStatus.PENDING_VERIFICATION;
    }
}
