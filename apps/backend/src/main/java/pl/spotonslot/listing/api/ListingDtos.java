package pl.spotonslot.listing.api;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.UUID;
import pl.spotonslot.artist.Genre;
import pl.spotonslot.listing.ListingKind;
import pl.spotonslot.listing.application.ListingView;
import pl.spotonslot.listing.domain.ListingDetails;
import pl.spotonslot.listing.domain.ListingStatus;

/** Request and response shapes of the listing API. */
final class ListingDtos {

    /** 100 000 PLN in grosze, as for artists' rates. */
    static final long MAX_PRICE = 10_000_000L;

    private ListingDtos() {
    }

    /**
     * A listing as its author saves it. Artists send the start and end of free time from their calendar and may
     * leave out {@code travelRadiusKm} (the profile's applies); venues ignore it.
     */
    record ListingRequest(
            @NotNull @Schema(requiredMode = REQUIRED) Instant startsAt,
            @NotNull @Schema(requiredMode = REQUIRED) Instant endsAt,
            @NotNull @Size(min = 1, max = 5) @Schema(requiredMode = REQUIRED) List<@NotNull Genre> genres,
            @Size(max = 1000) @Schema(description = "Artists: up to 500 characters") String description,
            @PositiveOrZero @Max(MAX_PRICE) @Schema(description = "Grosze") Long priceFrom,
            @PositiveOrZero @Max(MAX_PRICE) @Schema(description = "Grosze") Long priceTo,
            @Min(0) @Max(500) Integer travelRadiusKm) {

        ListingDetails toDetails() {
            var text = description == null || description.isBlank() ? null : description.strip();
            return new ListingDetails(startsAt, endsAt, EnumSet.copyOf(genres), text, priceFrom, priceTo,
                    travelRadiusKm);
        }
    }

    @Schema(name = "ListingArtist")
    record ArtistRef(@Schema(requiredMode = REQUIRED) String slug, @Schema(requiredMode = REQUIRED) String stageName) {
    }

    @Schema(name = "ListingVenue")
    record VenueRef(@Schema(requiredMode = REQUIRED) String slug, @Schema(requiredMode = REQUIRED) String name) {
    }

    /**
     * A listing for its author and the public alike (nothing private in it). {@code artist} or {@code venue} is
     * set by kind, and missing while that profile is unpublished. Prices are in grosze, genres in catalogue order.
     */
    record ListingResponse(
            @Schema(requiredMode = REQUIRED) UUID id,
            @Schema(requiredMode = REQUIRED) ListingKind kind,
            @Schema(requiredMode = REQUIRED) ListingStatus status,
            @Schema(requiredMode = REQUIRED) Instant startsAt,
            @Schema(requiredMode = REQUIRED) Instant endsAt,
            @Schema(requiredMode = REQUIRED) List<Genre> genres,
            String description,
            Long priceFrom,
            Long priceTo,
            String city,
            @Schema(description = "Artists only") Integer travelRadiusKm,
            ArtistRef artist,
            VenueRef venue,
            @Schema(requiredMode = REQUIRED) Instant createdAt,
            Instant closedAt) {

        static ListingResponse of(ListingView view) {
            var listing = view.listing();
            return new ListingResponse(listing.getId(), listing.getKind(), view.status(), listing.getStartsAt(),
                    listing.getEndsAt(), view.genres(), listing.getDescription(),
                    listing.getPriceFrom(), listing.getPriceTo(), listing.getCity(), listing.getTravelRadiusKm(),
                    view.artist() == null ? null : new ArtistRef(view.artist().slug(), view.artist().stageName()),
                    view.venue() == null ? null : new VenueRef(view.venue().slug(), view.venue().name()),
                    listing.getCreatedAt(), listing.getClosedAt());
        }
    }
}
