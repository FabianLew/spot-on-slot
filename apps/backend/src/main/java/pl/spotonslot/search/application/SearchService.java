package pl.spotonslot.search.application;

import java.text.Collator;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import pl.spotonslot.artist.ArtistCard;
import pl.spotonslot.artist.ArtistProfiles;
import pl.spotonslot.artist.Genre;
import pl.spotonslot.availability.Availability;
import pl.spotonslot.listing.ListingCard;
import pl.spotonslot.listing.ListingKind;
import pl.spotonslot.listing.ListingSearch;
import pl.spotonslot.listing.Listings;
import pl.spotonslot.location.GeoPoint;
import pl.spotonslot.location.Locations;
import pl.spotonslot.location.Nearby;
import pl.spotonslot.location.SubjectType;
import pl.spotonslot.media.MediaImage;
import pl.spotonslot.media.MediaLibrary;
import pl.spotonslot.search.domain.SearchErrors;
import pl.spotonslot.venue.NearbyVenue;
import pl.spotonslot.venue.VenueCard;
import pl.spotonslot.venue.VenueType;
import pl.spotonslot.venue.Venues;

/**
 * Finds artists, venues and listings near a point. Each owning module returns up to {@value #CANDIDATES} nearest
 * candidates filtered on its own data; this service applies what needs several modules (published authors, free
 * time, travel radius), orders by distance then name and pages in memory.
 */
@Service
@RequiredArgsConstructor
public class SearchService {

    public static final int DEFAULT_RADIUS_KM = 50;
    static final int CANDIDATES = 1000;
    /** Free time is a single slot or rule date, which lasts at most 24 h. */
    static final Duration MAX_FREE_SPAN = Duration.ofHours(24);
    static final Duration MAX_LISTING_SPAN = Duration.ofDays(366);

    private final Locations locations;
    private final ArtistProfiles artistProfiles;
    private final Venues venues;
    private final Listings listings;
    private final Availability availability;
    private final MediaLibrary mediaLibrary;

    /** Where to search: a point, or (both coordinates null) the searcher's own location. */
    public record Area(Double latitude, Double longitude, Integer radiusKm) {
    }

    public record ArtistFilters(Set<Genre> genres, Instant from, Instant to, Long budget, boolean willTravel) {
    }

    public record ListingFilters(ListingKind kind, Set<Genre> genres, Instant from, Instant to, Long budget) {
    }

    public record ArtistResult(ArtistCard artist, String city, GeoPoint point, double distanceMeters,
            MediaImage avatar) {
    }

    public record VenueResult(VenueCard venue, double distanceMeters, MediaImage avatar) {
    }

    /** Exactly one of {@code artist} and {@code venue}, matching the listing's kind. */
    public record ListingResult(ListingCard listing, double distanceMeters, ArtistCard artist,
            VenueCard venue) {
    }

    public Page<ArtistResult> artists(UUID searcher, Area area, ArtistFilters filters, Pageable pageable) {
        var center = center(searcher, area);
        checkTime(filters.from(), filters.to(), MAX_FREE_SPAN);
        var nearby = locations.findWithin(SubjectType.USER, center, radius(area), CANDIDATES);
        var cards = byKey(artistProfiles.findPublishedCards(nearby.stream().map(Nearby::subjectId).toList()),
                ArtistCard::ownerId);
        var matches = nearby.stream()
                .filter(place -> cards.containsKey(place.subjectId()))
                .map(place -> new ArtistResult(cards.get(place.subjectId()), place.city(), place.point(),
                        place.distanceMeters(), null))
                .filter(result -> anyOf(filters.genres(), result.artist().genres()))
                .filter(result -> filters.budget() == null || lowest(result.artist()) == null
                        || lowest(result.artist()) <= filters.budget())
                .filter(result -> !filters.willTravel()
                        || result.distanceMeters() <= result.artist().travelRadiusKm() * 1000.0)
                .toList();
        if (filters.from() != null) {
            var free = availability.freeAmong(matches.stream().map(r -> r.artist().ownerId()).toList(),
                    filters.from(), filters.to());
            matches = matches.stream().filter(result -> free.contains(result.artist().ownerId())).toList();
        }
        var names = collator();
        var page = page(matches.stream()
                .sorted(Comparator.comparingDouble(ArtistResult::distanceMeters)
                        .thenComparing(result -> result.artist().stageName(), names))
                .toList(), pageable);
        var avatars = avatars(page.getContent().stream().map(result -> result.artist().avatarMediaId()));
        return page.map(result -> new ArtistResult(result.artist(), result.city(), result.point(),
                result.distanceMeters(), avatars.get(result.artist().avatarMediaId())));
    }

    public Page<VenueResult> venues(UUID searcher, Area area, Set<Genre> genres, Set<VenueType> types,
            Pageable pageable) {
        var center = center(searcher, area);
        var names = collator();
        var page = page(venues.findPublishedWithin(center, radius(area), genres, types, CANDIDATES).stream()
                .sorted(Comparator.comparingDouble(NearbyVenue::distanceMeters)
                        .thenComparing(n -> n.venue().name(), names))
                .toList(), pageable);
        var avatars = avatars(page.getContent().stream().map(found -> found.venue().avatarMediaId()));
        return page.map(found -> new VenueResult(found.venue(), found.distanceMeters(),
                avatars.get(found.venue().avatarMediaId())));
    }

    public Page<ListingResult> listings(UUID searcher, Area area, ListingFilters filters, Pageable pageable) {
        var center = center(searcher, area);
        checkTime(filters.from(), filters.to(), MAX_LISTING_SPAN);
        var found = listings.findActiveWithin(new ListingSearch(center, radius(area), filters.kind(), filters.from(),
                filters.to(), filters.genres(), filters.budget(), CANDIDATES));
        var artists = byKey(artistProfiles.findPublishedCards(ids(found.stream().map(n -> n.listing().artistId()))),
                ArtistCard::ownerId);
        var venueCards = byKey(venues.findPublishedCards(ids(found.stream().map(n -> n.listing().venueId()))),
                VenueCard::id);
        var names = collator();
        return page(found.stream()
                .map(n -> new ListingResult(n.listing(), n.distanceMeters(),
                        n.listing().artistId() == null ? null : artists.get(n.listing().artistId()),
                        n.listing().venueId() == null ? null : venueCards.get(n.listing().venueId())))
                .filter(result -> result.artist() != null || result.venue() != null)
                .sorted(Comparator.comparingDouble(ListingResult::distanceMeters)
                        .thenComparing(SearchService::authorName, names)
                        .thenComparing(result -> result.listing().startsAt()))
                .toList(), pageable);
    }

    private GeoPoint center(UUID searcher, Area area) {
        if (area.latitude() == null && area.longitude() == null) {
            return locations.findPointForUser(searcher).orElseThrow(SearchErrors.LocationRequired::new);
        }
        if (area.latitude() == null || area.longitude() == null) {
            throw new SearchErrors.CenterIncomplete();
        }
        return new GeoPoint(area.latitude(), area.longitude());
    }

    private static double radius(Area area) {
        return area.radiusKm() == null ? DEFAULT_RADIUS_KM : area.radiusKm();
    }

    private static void checkTime(Instant from, Instant to, Duration maxSpan) {
        if (from == null && to == null) {
            return;
        }
        if (from == null || to == null || !from.isBefore(to) || Duration.between(from, to).compareTo(maxSpan) > 0) {
            throw new SearchErrors.TimeInvalid(maxSpan.toHours());
        }
    }

    private static boolean anyOf(Set<Genre> wanted, Set<Genre> genres) {
        return wanted.isEmpty() || genres.stream().anyMatch(wanted::contains);
    }

    /** The bottom of the artist's rate, or its top when only that is given. */
    private static Long lowest(ArtistCard artist) {
        return artist.rateFrom() != null ? artist.rateFrom() : artist.rateTo();
    }

    private static String authorName(ListingResult result) {
        return result.artist() != null ? result.artist().stageName() : result.venue().name();
    }

    private Map<UUID, MediaImage> avatars(Stream<UUID> ids) {
        // A HashMap, since cards without an avatar look up null.
        var wanted = ids(ids);
        return new HashMap<>(wanted.isEmpty() ? Map.of() : byKey(mediaLibrary.findAll(wanted), MediaImage::id));
    }

    private static List<UUID> ids(Stream<UUID> ids) {
        return ids.filter(Objects::nonNull).distinct().toList();
    }

    private static <K, V> Map<K, V> byKey(Collection<V> values, Function<V, K> key) {
        return values.stream().collect(Collectors.toMap(key, Function.identity(), (first, second) -> first));
    }

    private static <T> Page<T> page(List<T> all, Pageable pageable) {
        var from = (int) Math.min(pageable.getOffset(), all.size());
        var to = Math.min(from + pageable.getPageSize(), all.size());
        return new PageImpl<>(all.subList(from, to), pageable, all.size());
    }

    private static Collator collator() {
        return Collator.getInstance(Locale.forLanguageTag("pl"));
    }
}
