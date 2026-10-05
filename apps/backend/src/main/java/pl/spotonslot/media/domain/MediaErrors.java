package pl.spotonslot.media.domain;

import pl.spotonslot.shared.error.ConflictException;
import pl.spotonslot.shared.error.InvalidRequestException;
import pl.spotonslot.shared.error.NotFoundException;

/** Media failures with their problem codes. */
public final class MediaErrors {

    private MediaErrors() {
    }

    /** Neither JPEG, PNG nor WebP (by declared type or by content). */
    public static class UnsupportedType extends InvalidRequestException {
        public UnsupportedType() {
            super("MEDIA_UNSUPPORTED_TYPE");
        }
    }

    public static class TooLarge extends InvalidRequestException {
        public TooLarge(long maxMegabytes) {
            super("MEDIA_TOO_LARGE", maxMegabytes);
        }
    }

    /** Unknown, someone else's or expired upload; one answer for all three. */
    public static class UploadNotFound extends NotFoundException {
        public UploadNotFound() {
            super("MEDIA_UPLOAD_NOT_FOUND");
        }
    }

    /** The completion call came before the file reached storage, or with a different size than declared. */
    public static class FileMissing extends InvalidRequestException {
        public FileMissing() {
            super("MEDIA_FILE_MISSING");
        }
    }

    /** The file has an image signature but cannot be decoded, or has too many pixels. */
    public static class InvalidImage extends InvalidRequestException {
        public InvalidImage() {
            super("MEDIA_INVALID_IMAGE");
        }
    }

    public static class NotFound extends NotFoundException {
        public NotFound() {
            super("MEDIA_NOT_FOUND");
        }
    }

    public static class QuotaExceeded extends ConflictException {
        public QuotaExceeded(int quota) {
            super("MEDIA_QUOTA_EXCEEDED", quota);
        }
    }
}
