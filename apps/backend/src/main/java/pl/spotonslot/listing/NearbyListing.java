package pl.spotonslot.listing;

/** A listing found by {@link Listings#findActiveWithin}, with its distance from the search point. */
public record NearbyListing(ListingCard listing, double distanceMeters) {
}
