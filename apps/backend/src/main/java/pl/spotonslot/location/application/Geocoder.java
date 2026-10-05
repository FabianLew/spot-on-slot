package pl.spotonslot.location.application;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import pl.spotonslot.location.GeoPoint;
import pl.spotonslot.location.domain.Area;
import pl.spotonslot.location.domain.Place;

/**
 * Address lookup behind one interface, so the provider (Photon on OpenStreetMap today) can be swapped in one place.
 * Implementations throw {@link pl.spotonslot.location.domain.LocationErrors.GeocoderUnavailable} on any failure.
 */
public interface Geocoder {

    /** Suggestions for what the user is typing, best match first. */
    List<Place> search(String query, Locale locale);

    /** The town the point lies in, if any. */
    Optional<Area> reverse(GeoPoint point, Locale locale);
}
