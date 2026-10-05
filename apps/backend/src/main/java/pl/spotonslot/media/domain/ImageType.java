package pl.spotonslot.media.domain;

import java.util.Arrays;
import java.util.Optional;

/** Accepted upload formats, recognised by their first bytes rather than by what the browser claims. */
public enum ImageType {
    JPEG("image/jpeg"),
    PNG("image/png"),
    WEBP("image/webp");

    private final String contentType;

    ImageType(String contentType) {
        this.contentType = contentType;
    }

    public String contentType() {
        return contentType;
    }

    public static Optional<ImageType> fromContentType(String contentType) {
        return Arrays.stream(values()).filter(type -> type.contentType.equalsIgnoreCase(contentType)).findFirst();
    }

    /** Signature check: JPEG {@code FF D8 FF}, PNG {@code 89 PNG CR LF SUB LF}, WebP {@code RIFF....WEBP}. */
    public static Optional<ImageType> sniff(byte[] head) {
        if (startsWith(head, 0, 0xFF, 0xD8, 0xFF)) {
            return Optional.of(JPEG);
        }
        if (startsWith(head, 0, 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A)) {
            return Optional.of(PNG);
        }
        if (startsWith(head, 0, 'R', 'I', 'F', 'F') && startsWith(head, 8, 'W', 'E', 'B', 'P')) {
            return Optional.of(WEBP);
        }
        return Optional.empty();
    }

    private static boolean startsWith(byte[] data, int offset, int... expected) {
        if (data.length < offset + expected.length) {
            return false;
        }
        for (int i = 0; i < expected.length; i++) {
            if ((data[offset + i] & 0xFF) != expected[i]) {
                return false;
            }
        }
        return true;
    }
}
