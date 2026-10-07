package pl.spotonslot.notification.application;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import pl.spotonslot.artist.ArtistCard;
import pl.spotonslot.artist.ArtistProfiles;
import pl.spotonslot.artist.Genre;
import pl.spotonslot.availability.Availability;
import pl.spotonslot.booking.Bookings;
import pl.spotonslot.listing.ActiveListing;
import pl.spotonslot.listing.ListingKind;
import pl.spotonslot.listing.ListingPublished;
import pl.spotonslot.listing.Listings;
import pl.spotonslot.location.Locations;
import pl.spotonslot.location.Nearby;
import pl.spotonslot.location.SubjectType;
import pl.spotonslot.notification.NotificationCreated;
import pl.spotonslot.notification.domain.NearbyListingAlert;
import pl.spotonslot.notification.domain.Notification;
import pl.spotonslot.notification.domain.NotificationPreference;
import pl.spotonslot.notification.infrastructure.NotificationPreferenceRepository;
import pl.spotonslot.notification.infrastructure.NotificationRepository;
import pl.spotonslot.venue.NearbyVenue;
import pl.spotonslot.venue.Venues;

/**
 * Tells people about a new listing near them: "Szukam artysty" goes to artists whose travel radius reaches the venue,
 * "Jestem wolny" to the teams of venues within the artist's travel radius; both need a shared genre, and artists
 * booked at that time and venues with an accepted booking then are skipped. Runs once per
 * listing after it commits; a retry skips people already told.
 */
@Slf4j
@Component
@RequiredArgsConstructor
class NearbyListingAlerts {

    /** Nobody is told about a listing farther away than this, whatever their settings. */
    static final int MAX_RADIUS_KM = NotificationPreference.MAX_RADIUS_KM;
    /** Venue teams hear about artists within this distance unless they chose another. */
    static final int VENUE_DEFAULT_RADIUS_KM = 50;
    /** Nearest candidates looked at per listing; plenty for one city in the MVP. */
    private static final int MAX_CANDIDATES = 1000;

    private final Listings listings;
    private final ArtistProfiles artistProfiles;
    private final Venues venues;
    private final Locations locations;
    private final Availability availability;
    private final Bookings bookings;
    private final NotificationRepository notifications;
    private final NotificationPreferenceRepository preferences;
    private final ApplicationEventPublisher events;
    private final NotificationPayloads payloads;

    @ApplicationModuleListener
    void on(ListingPublished event) {
        // Closed or expired before this ran: nobody needs to hear about it any more.
        var listing = listings.findActive(event.listingId()).orElse(null);
        if (listing == null) {
            return;
        }
        var alerts = listing.kind() == ListingKind.VENUE_SEEKING ? forArtists(listing) : forVenueTeams(listing);
        var told = notifications.findRecipientsOfListing(listing.id());
        var fresh = alerts.entrySet().stream().filter(alert -> !told.contains(alert.getKey())).toList();
        for (var alert : fresh) {
            var notification = notifications.save(
                    Notification.nearbyListing(alert.getKey(), listing.id(), payloads.write(alert.getValue())));
            events.publishEvent(new NotificationCreated(notification.getId(), alert.getKey(),
                    notification.getType()));
        }
        log.info("Listing {} alerted {} people", listing.id(), fresh.size());
    }

    /** Published artists near a venue's listing, keyed by artist. */
    private Map<UUID, NearbyListingAlert> forArtists(ActiveListing listing) {
        var venue = venues.findPublished(listing.venueId()).orElse(null);
        if (venue == null) {
            return Map.of();
        }
        var team = venues.teamsOf(Set.of(venue.id())).getOrDefault(venue.id(), Set.of());
        var nearby = locations.findWithin(SubjectType.USER, listing.point(), MAX_RADIUS_KM, MAX_CANDIDATES).stream()
                .filter(candidate -> !team.contains(candidate.subjectId()))
                .collect(Collectors.toMap(Nearby::subjectId, Function.identity()));
        var cards = artistProfiles.findPublishedCards(nearby.keySet());
        var settings = settingsOf(cards.stream().map(ArtistCard::ownerId).toList());

        var matching = new ArrayList<ArtistCard>();
        for (var card : cards) {
            var setting = settings.get(card.ownerId());
            var radiusKm = setting != null && setting.getNearbyRadiusKm() != null
                    ? setting.getNearbyRadiusKm()
                    : Math.min(card.travelRadiusKm(), MAX_RADIUS_KM);
            var wanted = setting != null && !setting.getNearbyGenres().isEmpty()
                    ? setting.getNearbyGenres()
                    : card.genres();
            if ((setting == null || setting.isNearbyEnabled())
                    && nearby.get(card.ownerId()).distanceMeters() <= radiusKm * 1000.0
                    && sharesGenre(listing.genres(), wanted)) {
                matching.add(card);
            }
        }
        var ids = matching.stream().map(ArtistCard::ownerId).toList();
        var booked = availability.bookedAmong(ids, listing.startsAt(), listing.endsAt());
        var free = availability.freeAmong(ids, listing.startsAt(), listing.endsAt());

        var alerts = new HashMap<UUID, NearbyListingAlert>();
        for (var card : matching) {
            if (!booked.contains(card.ownerId())) {
                alerts.put(card.ownerId(), alert(listing, venue.name(), venue.slug(),
                        nearby.get(card.ownerId()).distanceMeters(), null, free.contains(card.ownerId())));
            }
        }
        return alerts;
    }

    /** Teams of published venues within the artist's travel radius, keyed by person, nearest venue first. */
    private Map<UUID, NearbyListingAlert> forVenueTeams(ActiveListing listing) {
        var artist = artistProfiles.findPublishedByOwner(listing.artistId()).orElse(null);
        if (artist == null) {
            return Map.of();
        }
        var reachKm = listing.travelRadiusKm() == null ? artist.travelRadiusKm() : listing.travelRadiusKm();
        var nearby = venues.findPublishedWithin(listing.point(), Math.clamp(reachKm, 1, MAX_RADIUS_KM), Set.of(),
                Set.of(), MAX_CANDIDATES);
        var teams = venues.teamsOf(nearby.stream().map(found -> found.venue().id()).toList());
        var people = teams.values().stream().flatMap(Set::stream).collect(Collectors.toSet());
        var settings = settingsOf(people);

        var alerts = new HashMap<UUID, NearbyListingAlert>();
        var decided = new HashSet<UUID>();
        for (NearbyVenue found : nearby) {
            if (found.distanceMeters() > reachKm * 1000.0
                    || bookings.venueHasAcceptedBetween(found.venue().id(), listing.startsAt(), listing.endsAt())) {
                continue;
            }
            for (var person : teams.getOrDefault(found.venue().id(), Set.of())) {
                if (person.equals(listing.artistId()) || decided.contains(person)) {
                    continue;
                }
                var setting = settings.get(person);
                if (setting != null && !setting.isNearbyEnabled()) {
                    decided.add(person);
                    continue;
                }
                var radiusKm = setting != null && setting.getNearbyRadiusKm() != null
                        ? setting.getNearbyRadiusKm()
                        : VENUE_DEFAULT_RADIUS_KM;
                var wanted = setting != null && !setting.getNearbyGenres().isEmpty()
                        ? setting.getNearbyGenres()
                        : found.venue().genres();
                if (found.distanceMeters() <= radiusKm * 1000.0 && sharesGenre(listing.genres(), wanted)) {
                    decided.add(person);
                    alerts.put(person, alert(listing, artist.stageName(), artist.slug(), found.distanceMeters(),
                            found.venue().name(), null));
                }
            }
        }
        return alerts;
    }

    private Map<UUID, NotificationPreference> settingsOf(Collection<UUID> userIds) {
        if (userIds.isEmpty()) {
            return Map.of();
        }
        return preferences.findByUserIdIn(userIds).stream()
                .collect(Collectors.toMap(NotificationPreference::getUserId, Function.identity()));
    }

    private static boolean sharesGenre(Set<Genre> offered, Set<Genre> wanted) {
        return offered.isEmpty() || wanted.isEmpty() || offered.stream().anyMatch(wanted::contains);
    }

    private static NearbyListingAlert alert(ActiveListing listing, String authorName, String authorSlug,
            double distanceMeters, String venueName, Boolean free) {
        return new NearbyListingAlert(listing.id(), listing.kind(), authorName, authorSlug, listing.city(),
                listing.startsAt(), listing.endsAt(), listing.genres().stream().sorted().toList(),
                listing.priceFrom(), listing.priceTo(), (int) Math.max(1, Math.round(distanceMeters / 1000)),
                venueName, free);
    }
}
