package pl.spotonslot.identity;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * @param version version of the terms of service and privacy policy that new accounts accept; stored with the
 *                account, never taken from the client
 */
@Validated
@ConfigurationProperties("spotonslot.terms")
public record TermsProperties(@NotBlank @DefaultValue("2026-10-07") String version) {
}
