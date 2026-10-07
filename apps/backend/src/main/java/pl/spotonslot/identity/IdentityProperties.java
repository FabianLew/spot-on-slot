package pl.spotonslot.identity;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * @param jwtSecret HMAC key for access tokens, at least 32 characters ({@code JWT_SECRET} in prod)
 * @param jwtIssuer {@code iss} claim of access tokens
 * @param accessTokenTtl access token lifetime
 * @param refreshTokenTtl refresh token lifetime; every refresh starts a new one
 * @param verificationTokenTtl e-mail verification link lifetime
 * @param resetTokenTtl password reset link lifetime
 * @param resendInterval minimum time between two verification or reset e-mails for one account
 * @param pendingRetention how long an unverified account is kept
 * @param emailChangeTokenTtl lifetime of the link that confirms a new e-mail address
 * @param deletionGrace how long an account waits for deletion (and can be restored) before it is purged
 * @param cookieSecure whether the refresh cookie is {@code Secure} (off only for plain-http local development)
 */
@Validated
@ConfigurationProperties("spotonslot.identity")
public record IdentityProperties(
        @NotBlank @Size(min = 32) String jwtSecret,
        @DefaultValue("spot-on-slot") String jwtIssuer,
        @DefaultValue("PT15M") Duration accessTokenTtl,
        @DefaultValue("P30D") Duration refreshTokenTtl,
        @DefaultValue("PT48H") Duration verificationTokenTtl,
        @DefaultValue("PT1H") Duration resetTokenTtl,
        @DefaultValue("PT1M") Duration resendInterval,
        @DefaultValue("P7D") Duration pendingRetention,
        @DefaultValue("PT24H") Duration emailChangeTokenTtl,
        @DefaultValue("P14D") Duration deletionGrace,
        @DefaultValue("true") boolean cookieSecure) {
}
