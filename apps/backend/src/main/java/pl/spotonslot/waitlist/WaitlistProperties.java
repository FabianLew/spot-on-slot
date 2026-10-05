package pl.spotonslot.waitlist;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * @param tokenTtl how long a confirmation token stays valid
 * @param resendInterval minimum time between two confirmation e-mails for the same pending sign-up
 * @param pendingRetention how long an unconfirmed sign-up is kept
 */
@ConfigurationProperties("spotonslot.waitlist")
public record WaitlistProperties(
        @DefaultValue("PT48H") Duration tokenTtl,
        @DefaultValue("PT10M") Duration resendInterval,
        @DefaultValue("P7D") Duration pendingRetention) {
}
