package pl.spotonslot.location.domain;

import pl.spotonslot.shared.error.BusinessRuleException;
import pl.spotonslot.shared.error.ConflictException;
import pl.spotonslot.shared.error.NotFoundException;
import pl.spotonslot.shared.error.ServiceUnavailableException;

/** Location failures with their problem codes. */
public final class LocationErrors {

    private LocationErrors() {
    }

    public static class NotSet extends NotFoundException {
        public NotSet() {
            super("LOCATION_NOT_SET");
        }
    }

    /** The geocoder failed, timed out or answered with an error. */
    public static class GeocoderUnavailable extends ServiceUnavailableException {
        public GeocoderUnavailable(Throwable cause) {
            super("LOCATION_GEOCODER_UNAVAILABLE");
            initCause(cause);
        }
    }

    /** Reverse geocoding found no town for the point, e.g. at sea. */
    public static class PlaceNotFound extends BusinessRuleException {
        public PlaceNotFound() {
            super("LOCATION_NOT_FOUND");
        }
    }

    /** Two saves for the same subject raced on the unique constraint. */
    public static class ConcurrentUpdate extends ConflictException {
        public ConcurrentUpdate() {
            super("LOCATION_CONCURRENT_UPDATE");
        }
    }
}
