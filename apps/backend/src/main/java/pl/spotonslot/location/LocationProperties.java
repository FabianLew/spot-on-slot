package pl.spotonslot.location;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * @param geocoderUrl Photon base address (public photon.komoot.io only for development; own instance in prod)
 * @param userAgent sent with every geocoder request, as the public instance's usage policy asks
 * @param connectTimeout geocoder connect timeout
 * @param readTimeout geocoder read timeout; suggestions must stay snappy
 * @param suggestionLimit suggestions per search
 * @param biasLatitude latitude results are biased towards (the middle of Poland)
 * @param biasLongitude longitude results are biased towards
 */
@Validated
@ConfigurationProperties("spotonslot.location")
public record LocationProperties(
        @NotBlank String geocoderUrl,
        @DefaultValue("SpotOnSlot (https://spotonslot.pl)") String userAgent,
        @DefaultValue("PT2S") Duration connectTimeout,
        @DefaultValue("PT4S") Duration readTimeout,
        @DefaultValue("5") @Min(1) @Max(10) int suggestionLimit,
        @DefaultValue("52.0") double biasLatitude,
        @DefaultValue("19.0") double biasLongitude) {
}
