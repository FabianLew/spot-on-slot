package pl.spotonslot.location.domain;

import pl.spotonslot.location.GeoPoint;

/**
 * A geocoder suggestion: a town, street or address with its point. {@code street} is the street with its house
 * number for an address, the street name for a street, and null for a town.
 */
public record Place(Kind kind, String label, String street, String postalCode, String city, String region,
        String countryCode, GeoPoint point) {

    public enum Kind {
        CITY,
        DISTRICT,
        LOCALITY,
        STREET,
        HOUSE
    }
}
