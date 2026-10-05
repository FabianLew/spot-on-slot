package pl.spotonslot.media;

import jakarta.validation.constraints.NotBlank;
import java.net.URI;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.util.unit.DataSize;
import org.springframework.validation.annotation.Validated;

/**
 * @param endpoint S3 API address the backend talks to (Cloudflare R2 in prod, S3Mock locally)
 * @param presignEndpoint address put into upload links for the browser; defaults to {@code endpoint}
 * @param region signing region ({@code auto} for R2)
 * @param bucket bucket holding uploads and variants
 * @param accessKey S3 access key
 * @param secretKey S3 secret key
 * @param publicBaseUrl public address variants are served from, without a trailing slash
 * @param maxSize largest accepted upload
 * @param maxPixels largest accepted width × height, checked before decoding
 * @param uploadTtl lifetime of an upload link
 * @param pendingRetention how long an upload that was never completed is kept
 * @param quota images per account
 */
@Validated
@ConfigurationProperties("spotonslot.media")
public record MediaProperties(
        @NotBlank String endpoint,
        String presignEndpoint,
        @DefaultValue("auto") String region,
        @NotBlank String bucket,
        @NotBlank String accessKey,
        @NotBlank String secretKey,
        @NotBlank String publicBaseUrl,
        @DefaultValue("10MB") DataSize maxSize,
        @DefaultValue("40000000") long maxPixels,
        @DefaultValue("PT10M") Duration uploadTtl,
        @DefaultValue("PT24H") Duration pendingRetention,
        @DefaultValue("200") int quota) {

    public URI presignUri() {
        return URI.create(presignEndpoint == null || presignEndpoint.isBlank() ? endpoint : presignEndpoint);
    }
}
