package pl.spotonslot.location.domain;

/** The town a point lies in, as found by reverse geocoding. {@code region} and {@code countryCode} may be null. */
public record Area(String city, String region, String countryCode) {

    public String label() {
        return region == null ? city : city + ", " + region;
    }
}
