package pl.spotonslot.listing.domain;

import java.time.Instant;
import java.util.Set;
import pl.spotonslot.artist.Genre;

/** What the author of a listing edits; {@code travelRadiusKm} only applies to artists and is filled in by then. */
public record ListingDetails(Instant startsAt, Instant endsAt, Set<Genre> genres, String description, Long priceFrom,
        Long priceTo, Integer travelRadiusKm) {

    public ListingDetails withTravelRadiusKm(Integer travelRadiusKm) {
        return new ListingDetails(startsAt, endsAt, genres, description, priceFrom, priceTo, travelRadiusKm);
    }
}
