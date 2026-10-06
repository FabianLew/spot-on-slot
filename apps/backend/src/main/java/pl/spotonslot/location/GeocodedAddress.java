package pl.spotonslot.location;

/** An address found by the geocoder, with its exact point (for businesses; people's points are approximated). */
public record GeocodedAddress(String street, String postalCode, String city, String region, String countryCode,
        GeoPoint point) {
}
