package pl.spotonslot.search.api;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.PositiveOrZero;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import pl.spotonslot.artist.Genre;
import pl.spotonslot.listing.ListingKind;
import pl.spotonslot.location.GeoPoint;
import pl.spotonslot.media.MediaImage;
import pl.spotonslot.search.application.SearchService;
import pl.spotonslot.search.application.SearchService.ArtistResult;
import pl.spotonslot.search.application.SearchService.ListingResult;
import pl.spotonslot.search.application.SearchService.VenueResult;
import pl.spotonslot.venue.VenueType;

final class SearchDtos {

    private SearchDtos() {
    }

    /** Where to search; without {@code lat} and {@code lng} the searcher's own location is the centre. */
    record AreaParams(
            @DecimalMin("-90") @DecimalMax("90") @Schema(example = "50.0614") Double lat,
            @DecimalMin("-180") @DecimalMax("180") @Schema(example = "19.9366") Double lng,
            @Min(1) @Max(200) @Schema(description = "Defaults to 50 km") Integer radiusKm) {

        SearchService.Area toArea() {
            return new SearchService.Area(lat, lng, radiusKm);
        }
    }

    record ArtistParams(
            @Schema(description = "Any of these") List<Genre> genres,
            @Schema(description = "With to: free for the whole time, at most 24 h") Instant from,
            Instant to,
            @PositiveOrZero @Schema(description = "Grosze; rates starting above it are left out") Long budget,
            @Schema(description = "Only artists whose travel radius reaches the centre") Boolean willTravel) {

        SearchService.ArtistFilters toFilters() {
            return new SearchService.ArtistFilters(genreSet(genres), from, to, budget, Boolean.TRUE.equals(willTravel));
        }
    }

    record VenueParams(
            @Schema(description = "Any of these") List<Genre> genres,
            @Schema(description = "Any of these") List<VenueType> types) {
    }

    record ListingParams(
            ListingKind kind,
            @Schema(description = "Any of these") List<Genre> genres,
            @Schema(description = "With to: listings overlapping this time") Instant from,
            Instant to,
            @PositiveOrZero @Schema(description = "Grosze; venues' top amount reaches it, artists' bottom amount"
                    + " stays within it; listings without amounts always match") Long budget) {

        SearchService.ListingFilters toFilters() {
            return new SearchService.ListingFilters(kind, genreSet(genres), from, to, budget);
        }
    }

    @Schema(name = "SearchImage")
    record Image(
            @Schema(requiredMode = REQUIRED) UUID id,
            @Schema(requiredMode = REQUIRED) int width,
            @Schema(requiredMode = REQUIRED) int height,
            @Schema(requiredMode = REQUIRED, description = "320 px WebP") String small,
            @Schema(requiredMode = REQUIRED, description = "800 px WebP") String medium,
            @Schema(requiredMode = REQUIRED, description = "1600 px WebP") String large) {

        static Image of(MediaImage image) {
            return image == null ? null
                    : new Image(image.id(), image.width(), image.height(), image.small(), image.medium(),
                            image.large());
        }
    }

    /** A published artist; the point is their approximated (~1 km) location, never an exact one. */
    @Schema(name = "SearchArtist")
    record ArtistHit(
            @Schema(requiredMode = REQUIRED) String slug,
            @Schema(requiredMode = REQUIRED) String stageName,
            @Schema(requiredMode = REQUIRED) String city,
            @Schema(requiredMode = REQUIRED) List<Genre> genres,
            Image avatar,
            @Schema(description = "Grosze") Long rateFrom,
            @Schema(description = "Grosze") Long rateTo,
            @Schema(requiredMode = REQUIRED) int travelRadiusKm,
            @Schema(requiredMode = REQUIRED, description = "From the centre, one decimal") double distanceKm,
            @Schema(requiredMode = REQUIRED) double latitude,
            @Schema(requiredMode = REQUIRED) double longitude) {

        static ArtistHit of(ArtistResult result) {
            var artist = result.artist();
            return new ArtistHit(artist.slug(), artist.stageName(), result.city(), sorted(artist.genres()),
                    Image.of(result.avatar()), artist.rateFrom(), artist.rateTo(), artist.travelRadiusKm(),
                    km(result.distanceMeters()), result.point().latitude(), result.point().longitude());
        }
    }

    /** A published venue; the point is exact (business address). */
    @Schema(name = "SearchVenue")
    record VenueHit(
            @Schema(requiredMode = REQUIRED) String slug,
            @Schema(requiredMode = REQUIRED) String name,
            @Schema(requiredMode = REQUIRED) VenueType type,
            String city,
            @Schema(requiredMode = REQUIRED) List<Genre> genres,
            Integer capacity,
            Image avatar,
            @Schema(requiredMode = REQUIRED, description = "From the centre, one decimal") double distanceKm,
            @Schema(requiredMode = REQUIRED) double latitude,
            @Schema(requiredMode = REQUIRED) double longitude) {

        static VenueHit of(VenueResult result) {
            var venue = result.venue();
            return new VenueHit(venue.slug(), venue.name(), venue.type(), venue.city(), sorted(venue.genres()),
                    venue.capacity(), Image.of(result.avatar()), km(result.distanceMeters()),
                    venue.point().latitude(), venue.point().longitude());
        }
    }

    @Schema(name = "SearchListingArtist")
    record ArtistRef(@Schema(requiredMode = REQUIRED) String slug, @Schema(requiredMode = REQUIRED) String stageName) {
    }

    @Schema(name = "SearchListingVenue")
    record VenueRef(@Schema(requiredMode = REQUIRED) String slug, @Schema(requiredMode = REQUIRED) String name) {
    }

    /** An active listing of a published author; exactly one of {@code artist} and {@code venue}. */
    @Schema(name = "SearchListing")
    record ListingHit(
            @Schema(requiredMode = REQUIRED) UUID id,
            @Schema(requiredMode = REQUIRED) ListingKind kind,
            @Schema(requiredMode = REQUIRED) Instant startsAt,
            @Schema(requiredMode = REQUIRED) Instant endsAt,
            @Schema(requiredMode = REQUIRED) List<Genre> genres,
            String description,
            @Schema(description = "Grosze") Long priceFrom,
            @Schema(description = "Grosze") Long priceTo,
            @Schema(description = "Artists only") Integer travelRadiusKm,
            String city,
            ArtistRef artist,
            VenueRef venue,
            @Schema(requiredMode = REQUIRED, description = "From the centre, one decimal") double distanceKm,
            @Schema(requiredMode = REQUIRED, description = "Artists: approximated (~1 km); venues: exact")
            double latitude,
            @Schema(requiredMode = REQUIRED) double longitude) {

        static ListingHit of(ListingResult result) {
            var listing = result.listing();
            GeoPoint point = listing.point();
            return new ListingHit(listing.id(), listing.kind(), listing.startsAt(), listing.endsAt(),
                    sorted(listing.genres()), listing.description(), listing.priceFrom(), listing.priceTo(),
                    listing.travelRadiusKm(), listing.city(),
                    result.artist() == null ? null : new ArtistRef(result.artist().slug(), result.artist().stageName()),
                    result.venue() == null ? null : new VenueRef(result.venue().slug(), result.venue().name()),
                    km(result.distanceMeters()), point.latitude(), point.longitude());
        }
    }

    static Set<Genre> genreSet(List<Genre> genres) {
        return genres == null || genres.isEmpty() ? Set.of() : EnumSet.copyOf(genres);
    }

    static <E extends Enum<E>> Set<E> set(List<E> values, Class<E> type) {
        return values == null || values.isEmpty() ? EnumSet.noneOf(type) : EnumSet.copyOf(values);
    }

    private static List<Genre> sorted(Set<Genre> genres) {
        return genres.stream().sorted().toList();
    }

    private static double km(double meters) {
        return Math.round(meters / 100) / 10.0;
    }
}
