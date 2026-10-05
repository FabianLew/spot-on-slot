package pl.spotonslot.media.infrastructure;

import java.time.Duration;
import java.util.Map;
import java.util.OptionalLong;
import java.util.TreeMap;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import pl.spotonslot.media.MediaProperties;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

/** The media bucket: presigned uploads in, processed variants out. */
@Slf4j
@Component
@RequiredArgsConstructor
public class ObjectStorage {

    private final S3Client s3;
    private final S3Presigner presigner;
    private final MediaProperties properties;

    /** A PUT link whose signature covers the content type and length, so the browser cannot send anything else. */
    public record PresignedPut(String url, Map<String, String> headers) {
    }

    public PresignedPut presignPut(String key, String contentType, long size, Duration ttl) {
        var presigned = presigner.presignPutObject(request -> request
                .signatureDuration(ttl)
                .putObjectRequest(put -> put
                        .bucket(properties.bucket())
                        .key(key)
                        .contentType(contentType)
                        .contentLength(size)));
        // Browsers set Host and Content-Length themselves and refuse to let scripts set them.
        var headers = new TreeMap<String, String>();
        presigned.signedHeaders().forEach((name, values) -> {
            if (!name.equalsIgnoreCase("host") && !name.equalsIgnoreCase("content-length")) {
                headers.put(name, String.join(",", values));
            }
        });
        return new PresignedPut(presigned.url().toString(), headers);
    }

    /** Size of the stored object, or empty when nothing was uploaded under {@code key}. */
    public OptionalLong size(String key) {
        try {
            return OptionalLong.of(s3.headObject(head -> head.bucket(properties.bucket()).key(key)).contentLength());
        } catch (NoSuchKeyException e) {
            return OptionalLong.empty();
        } catch (S3Exception e) {
            if (e.statusCode() == 404) {
                return OptionalLong.empty();
            }
            throw e;
        }
    }

    public byte[] read(String key) {
        return s3.getObjectAsBytes(get -> get.bucket(properties.bucket()).key(key)).asByteArray();
    }

    /** Variants never change once written, so caches may keep them for a year. */
    public void putImmutable(String key, byte[] data, String contentType) {
        s3.putObject(put -> put
                        .bucket(properties.bucket())
                        .key(key)
                        .contentType(contentType)
                        .cacheControl("public, max-age=31536000, immutable"),
                RequestBody.fromBytes(data));
    }

    /** Best effort: a failed delete leaves an orphaned object, which is logged rather than failing the caller. */
    public void deleteQuietly(String key) {
        try {
            s3.deleteObject(delete -> delete.bucket(properties.bucket()).key(key));
        } catch (RuntimeException e) {
            log.warn("Could not delete object {}", key, e);
        }
    }

    public String publicUrl(String key) {
        return properties.publicBaseUrl() + "/" + key;
    }
}
