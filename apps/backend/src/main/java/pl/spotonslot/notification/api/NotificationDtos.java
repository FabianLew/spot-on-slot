package pl.spotonslot.notification.api;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import pl.spotonslot.artist.Genre;
import pl.spotonslot.booking.BookingParty;
import pl.spotonslot.listing.ListingKind;
import pl.spotonslot.notification.NotificationType;
import pl.spotonslot.notification.application.NotificationSettings;
import pl.spotonslot.notification.application.NotificationView;
import pl.spotonslot.notification.domain.BookingUpdate;
import pl.spotonslot.notification.domain.NearbyListingAlert;
import pl.spotonslot.notification.domain.NotificationPreference;

/** Request and response shapes of the notification API. */
final class NotificationDtos {

    private NotificationDtos() {
    }

    /**
     * One notification; the field named after its type holds what to show.
     *
     * @param active whether what it points to is still current (a listing still active); shown greyed out if not
     */
    record NotificationResponse(
            @Schema(requiredMode = REQUIRED) UUID id,
            @Schema(requiredMode = REQUIRED) NotificationType type,
            @Schema(requiredMode = REQUIRED) Instant createdAt,
            Instant readAt,
            @Schema(requiredMode = REQUIRED) boolean active,
            @Schema(description = "Set for NEARBY_LISTING") NearbyListingResponse nearbyListing,
            @Schema(description = "Set for BOOKING") BookingNotificationResponse booking) {

        static NotificationResponse of(NotificationView view) {
            var notification = view.notification();
            return new NotificationResponse(notification.getId(), notification.getType(),
                    notification.getCreatedAt(), notification.getReadAt(), view.active(),
                    view.nearbyListing() == null ? null : NearbyListingResponse.of(view.nearbyListing()),
                    view.booking() == null ? null : BookingNotificationResponse.of(view.booking()));
        }
    }

    /**
     * A step of the recipient's booking. {@code otherName} is the other side (the venue's name for the artist, the
     * artist's stage name for the venue's team); {@code by} is that side or SYSTEM; the amount is in grosze.
     */
    record BookingNotificationResponse(
            @Schema(requiredMode = REQUIRED) UUID bookingId,
            @Schema(requiredMode = REQUIRED) BookingUpdate.Kind kind,
            @Schema(requiredMode = REQUIRED) BookingParty by,
            @Schema(requiredMode = REQUIRED) String otherName,
            @Schema(requiredMode = REQUIRED) Instant startsAt,
            @Schema(requiredMode = REQUIRED) Instant endsAt,
            @Schema(requiredMode = REQUIRED) long amount) {

        static BookingNotificationResponse of(BookingUpdate update) {
            return new BookingNotificationResponse(update.bookingId(), update.kind(), update.by(),
                    update.otherName(), update.startsAt(), update.endsAt(), update.amount());
        }
    }

    /**
     * A listing posted nearby. {@code authorName}/{@code authorSlug} are the venue's (VENUE_SEEKING) or the artist's
     * (ARTIST_AVAILABLE); prices are in grosze.
     */
    record NearbyListingResponse(
            @Schema(requiredMode = REQUIRED) UUID listingId,
            @Schema(requiredMode = REQUIRED) ListingKind kind,
            @Schema(requiredMode = REQUIRED) String authorName,
            @Schema(requiredMode = REQUIRED) String authorSlug,
            String city,
            @Schema(requiredMode = REQUIRED) Instant startsAt,
            @Schema(requiredMode = REQUIRED) Instant endsAt,
            @Schema(requiredMode = REQUIRED) List<Genre> genres,
            Long priceFrom,
            Long priceTo,
            @Schema(requiredMode = REQUIRED, description = "Whole kilometres, at least 1") int distanceKm,
            @Schema(description = "Venue teams: their venue the distance is measured from") String venueName,
            @Schema(description = "Artists: whether their calendar is free then") Boolean free) {

        static NearbyListingResponse of(NearbyListingAlert alert) {
            return new NearbyListingResponse(alert.listingId(), alert.kind(), alert.authorName(), alert.authorSlug(),
                    alert.city(), alert.startsAt(), alert.endsAt(), alert.genres(), alert.priceFrom(),
                    alert.priceTo(), alert.distanceKm(), alert.venueName(), alert.free());
        }
    }

    record UnreadCountResponse(@Schema(requiredMode = REQUIRED) long count) {
    }

    record PreferencesRequest(@Valid @NotNull @Schema(requiredMode = REQUIRED) NearbyListingsRequest nearbyListings) {
    }

    /**
     * Alerts about listings nearby: in the app when {@code enabled}, also by e-mail when {@code email}.
     *
     * @param radiusKm {@code null} = the default (artists: travel radius; venues: 50 km)
     * @param genres empty or {@code null} = the genres of the profile or venues
     */
    record NearbyListingsRequest(
            @NotNull @Schema(requiredMode = REQUIRED) Boolean enabled,
            @NotNull @Schema(requiredMode = REQUIRED) Boolean email,
            @Min(NotificationPreference.MIN_RADIUS_KM) @Max(NotificationPreference.MAX_RADIUS_KM) Integer radiusKm,
            @Size(max = 30) List<@NotNull Genre> genres) {
    }

    record PreferencesResponse(@Schema(requiredMode = REQUIRED) NearbyListingsResponse nearbyListings) {

        static PreferencesResponse of(NotificationSettings settings) {
            return new PreferencesResponse(new NearbyListingsResponse(settings.enabled(), settings.email(),
                    settings.radiusKm(), settings.genres(), settings.defaultRadiusKm(), settings.defaultGenres()));
        }
    }

    /** Stored settings plus the defaults that apply where they are empty. */
    record NearbyListingsResponse(
            @Schema(requiredMode = REQUIRED) boolean enabled,
            @Schema(requiredMode = REQUIRED) boolean email,
            Integer radiusKm,
            @Schema(requiredMode = REQUIRED) List<Genre> genres,
            @Schema(requiredMode = REQUIRED) int defaultRadiusKm,
            @Schema(requiredMode = REQUIRED) List<Genre> defaultGenres) {
    }

    record UnsubscribeRequest(@NotBlank @Size(max = 64) @Schema(requiredMode = REQUIRED) String token) {
    }
}
