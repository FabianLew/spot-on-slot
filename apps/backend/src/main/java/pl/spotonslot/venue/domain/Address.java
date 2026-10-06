package pl.spotonslot.venue.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.util.Objects;
import java.util.Optional;
import pl.spotonslot.location.GeoPoint;

/** Where a venue is: public business data, the point exact. The point is null when the address was not found. */
@Embeddable
public record Address(
        @Column(name = "street") String street,
        @Column(name = "postal_code") String postalCode,
        @Column(name = "city") String city,
        @Column(name = "latitude") Double latitude,
        @Column(name = "longitude") Double longitude) {

    public static Address of(String street, String postalCode, String city, GeoPoint point) {
        return new Address(street, postalCode, city, point == null ? null : point.latitude(),
                point == null ? null : point.longitude());
    }

    public Optional<GeoPoint> point() {
        return latitude == null || longitude == null ? Optional.empty()
                : Optional.of(new GeoPoint(latitude, longitude));
    }

    /** Same street, postal code and town, whatever the point. */
    public boolean sameTextAs(Address other) {
        return other != null && Objects.equals(street, other.street) && Objects.equals(postalCode, other.postalCode)
                && Objects.equals(city, other.city);
    }

    /** "Rynek Główny 1, 31-042 Kraków" for the geocoder. */
    public String query() {
        var town = postalCode == null ? city : postalCode + " " + city;
        return street + ", " + town;
    }
}
