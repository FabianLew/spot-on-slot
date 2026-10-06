package pl.spotonslot.search.domain;

import pl.spotonslot.shared.error.InvalidRequestException;

/** Search failures with their problem codes. */
public final class SearchErrors {

    private SearchErrors() {
    }

    /** No centre given and the searcher has not set a location. */
    public static class LocationRequired extends InvalidRequestException {
        public LocationRequired() {
            super("SEARCH_LOCATION_REQUIRED");
        }
    }

    /** Only one of {@code lat} and {@code lng}. */
    public static class CenterIncomplete extends InvalidRequestException {
        public CenterIncomplete() {
            super("SEARCH_CENTER_INCOMPLETE");
        }
    }

    /** Only one of {@code from} and {@code to}, an end not after the start, or a range longer than allowed. */
    public static class TimeInvalid extends InvalidRequestException {
        public TimeInvalid(long maxHours) {
            super("SEARCH_TIME_INVALID", maxHours);
        }
    }
}
