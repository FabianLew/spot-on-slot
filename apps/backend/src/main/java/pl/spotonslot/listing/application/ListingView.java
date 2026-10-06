package pl.spotonslot.listing.application;

import java.util.List;
import pl.spotonslot.artist.ArtistSummary;
import pl.spotonslot.artist.Genre;
import pl.spotonslot.listing.domain.Listing;
import pl.spotonslot.listing.domain.ListingStatus;
import pl.spotonslot.venue.VenueSummary;

/**
 * A listing with its status as of now and who posted it; {@code artist} or {@code venue} is null when that profile
 * is not published (any more). {@code genres} are loaded, in catalogue order.
 */
public record ListingView(Listing listing, ListingStatus status, List<Genre> genres, ArtistSummary artist,
        VenueSummary venue) {
}
