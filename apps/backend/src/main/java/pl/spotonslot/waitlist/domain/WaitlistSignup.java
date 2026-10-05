package pl.spotonslot.waitlist.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Duration;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import pl.spotonslot.shared.persistence.BaseEntity;

/**
 * A waitlist sign-up. It starts {@link WaitlistStatus#PENDING} with a confirmation token and becomes
 * {@link WaitlistStatus#CONFIRMED} once the e-mail address is confirmed. The e-mail is stored lowercased.
 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "waitlist_signup")
public class WaitlistSignup extends BaseEntity {

    @Column(name = "email", nullable = false, length = 254, updatable = false)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 16)
    private WaitlistRole role;

    @Column(name = "city", nullable = false, length = 100)
    private String city;

    @Column(name = "locale", nullable = false, length = 2)
    private String locale;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private WaitlistStatus status;

    @Column(name = "token_hash", nullable = false, length = 64)
    private String tokenHash;

    @Column(name = "token_expires_at", nullable = false)
    private Instant tokenExpiresAt;

    @Column(name = "token_sent_at", nullable = false)
    private Instant tokenSentAt;

    @Column(name = "consent_at", nullable = false, updatable = false)
    private Instant consentAt;

    @Column(name = "confirmed_at")
    private Instant confirmedAt;

    public static WaitlistSignup pending(String email, WaitlistRole role, String city, String locale,
            String tokenHash, Instant expiresAt, Instant now) {
        var signup = new WaitlistSignup();
        signup.email = email;
        signup.status = WaitlistStatus.PENDING;
        signup.consentAt = now;
        signup.refresh(role, city, locale);
        signup.issueToken(tokenHash, expiresAt, now);
        return signup;
    }

    /** Updates the details given in a repeated sign-up. */
    public void refresh(WaitlistRole role, String city, String locale) {
        this.role = role;
        this.city = city;
        this.locale = locale;
    }

    /** Replaces the confirmation token; the previous one stops working. */
    public void issueToken(String tokenHash, Instant expiresAt, Instant now) {
        this.tokenHash = tokenHash;
        this.tokenExpiresAt = expiresAt;
        this.tokenSentAt = now;
    }

    /** Whether a new confirmation e-mail may be sent: still pending and the last one is at least {@code interval} old. */
    public boolean canResend(Instant now, Duration interval) {
        return status == WaitlistStatus.PENDING && !now.isBefore(tokenSentAt.plus(interval));
    }

    /** Marks the e-mail address as confirmed; confirming again keeps the original time. */
    public void confirm(Instant now) {
        if (status == WaitlistStatus.CONFIRMED) {
            return;
        }
        status = WaitlistStatus.CONFIRMED;
        confirmedAt = now;
    }
}
