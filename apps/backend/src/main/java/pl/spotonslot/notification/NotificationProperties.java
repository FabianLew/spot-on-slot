package pl.spotonslot.notification;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * @param mail outgoing e-mail settings ({@code spotonslot.mail.*})
 * @param landing the public landing page that e-mail links point to ({@code spotonslot.landing.*})
 * @param web the web app that account e-mail links point to ({@code spotonslot.web.*})
 */
@Validated
@ConfigurationProperties("spotonslot")
public record NotificationProperties(@Valid @NotNull Mail mail, @Valid @NotNull Landing landing,
        @Valid @NotNull Web web) {

    /** @param from sender address of every e-mail */
    public record Mail(@NotBlank @Email String from) {
    }

    /** @param baseUrl landing origin without a trailing slash, e.g. {@code https://spotonslot.pl} */
    public record Landing(@NotBlank @Pattern(regexp = "https?://\\S+") String baseUrl) {

        public Landing {
            if (baseUrl != null && baseUrl.endsWith("/")) {
                baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
            }
        }
    }

    /** @param baseUrl web app origin without a trailing slash, e.g. {@code https://app.spotonslot.pl} */
    public record Web(@NotBlank @Pattern(regexp = "https?://\\S+") String baseUrl) {

        public Web {
            if (baseUrl != null && baseUrl.endsWith("/")) {
                baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
            }
        }
    }
}
