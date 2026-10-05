package pl.spotonslot.location.domain;

import pl.spotonslot.location.GeoPoint;

/** A geocoder suggestion: a city, street or address with its point. */
public record Place(String label, String city, String region, String countryCode, GeoPoint point) {
}
