package pl.spotonslot.location;

/** Where a subject is, as shown to others: the town only, never coordinates. */
public record LocationSummary(String label, String city, String region, String countryCode) {
}
