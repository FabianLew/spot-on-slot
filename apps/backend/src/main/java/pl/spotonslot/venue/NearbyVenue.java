package pl.spotonslot.venue;

/** A venue found by {@link Venues#findPublishedWithin}, with its distance from the search point. */
public record NearbyVenue(VenueCard venue, double distanceMeters) {
}
