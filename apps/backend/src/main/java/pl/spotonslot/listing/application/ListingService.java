package pl.spotonslot.listing.application;

import jakarta.persistence.criteria.Predicate;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.spotonslot.artist.ArtistProfiles;
import pl.spotonslot.artist.ArtistSummary;
import pl.spotonslot.artist.Genre;
import pl.spotonslot.availability.Availability;
import pl.spotonslot.listing.ActiveListing;
import pl.spotonslot.listing.ListingCard;
import pl.spotonslot.listing.ListingKind;
import pl.spotonslot.listing.ListingPublished;
import pl.spotonslot.listing.ListingSearch;
import pl.spotonslot.listing.NearbyListing;
import pl.spotonslot.listing.domain.Listing;
import pl.spotonslot.listing.domain.ListingDetails;
import pl.spotonslot.listing.domain.ListingErrors;
import pl.spotonslot.listing.domain.ListingStatus;
import pl.spotonslot.listing.infrastructure.ListingRepository;
import pl.spotonslot.location.Locations;
import pl.spotonslot.venue.VenueSummary;
import pl.spotonslot.venue.Venues;

/** Posting, editing and closing listings, the authors' lists, the public view and expiry. */
@Service
@RequiredArgsConstructor
public class ListingService {

    public static final int MAX_ACTIVE_PER_ARTIST = 20;
    public static final int MAX_ACTIVE_PER_VENUE = 30;
    public static final int MAX_ARTIST_DESCRIPTION = 500;
    public static final long MAX_DAYS_AHEAD = 365;
    static final Duration MIN_LENGTH = Duration.ofMinutes(30);
    static final Duration MAX_LENGTH = Duration.ofHours(24);
    /** Keeps listing locks apart from the calendar's per-artist lock on the same id. */
    private static final long LOCK_SALT = 0x4c495354L;

    private final ListingRepository listings;
    private final ArtistProfiles artistProfiles;
    private final Venues venues;
    private final Locations locations;
    private final Availability availability;
    private final ApplicationEventPublisher events;
    private final JdbcTemplate jdbc;
    private final Clock clock;

    // ---- posting

    /** "I'm free" for time that is free in the artist's calendar. */
    @Transactional
    public ListingView announce(UUID artistId, ListingDetails details) {
        var artist = artistProfiles.findPublishedByOwner(artistId).orElseThrow(ListingErrors.ProfileRequired::new);
        var point = locations.findPointForUser(artistId).orElseThrow(ListingErrors.ProfileRequired::new);
        var city = locations.findForUser(artistId).map(location -> location.city()).orElse(null);
        var withRadius = details.travelRadiusKm() == null
                ? details.withTravelRadiusKm(artist.travelRadiusKm())
                : details;
        checkDetails(withRadius, MAX_ARTIST_DESCRIPTION);
        lock(artistId);
        if (listings.countUpcomingOfArtist(artistId, now()) >= MAX_ACTIVE_PER_ARTIST) {
            throw new ListingErrors.LimitReached(MAX_ACTIVE_PER_ARTIST);
        }
        checkArtistTime(artistId, null, withRadius);
        var listing = listings.save(Listing.artistAvailable(artistId, city, point, withRadius));
        published(listing);
        return new ListingView(listing, listing.statusAt(now()), genres(listing), artist, null);
    }

    /** "Looking for an artist" for a published venue the caller manages. */
    @Transactional
    public ListingView seek(UUID userId, UUID venueId, ListingDetails details) {
        requireMember(userId, venueId);
        var venue = venues.findPublished(venueId).orElseThrow(ListingErrors.VenueNotPublished::new);
        checkDetails(details, Integer.MAX_VALUE);
        lock(venueId);
        if (listings.countUpcomingOfVenue(venueId, now()) >= MAX_ACTIVE_PER_VENUE) {
            throw new ListingErrors.LimitReached(MAX_ACTIVE_PER_VENUE);
        }
        var listing = listings.save(Listing.venueSeeking(venueId, userId, venue.city(), venue.point(), details));
        published(listing);
        return new ListingView(listing, listing.statusAt(now()), genres(listing), null, venue);
    }

    // ---- the author's side

    @Transactional
    public ListingView update(UUID userId, UUID listingId, ListingDetails details) {
        var listing = own(userId, listingId);
        requireActive(listing);
        if (listing.getKind() == ListingKind.ARTIST_AVAILABLE) {
            var radius = details.travelRadiusKm() == null ? listing.getTravelRadiusKm() : details.travelRadiusKm();
            var withRadius = details.withTravelRadiusKm(radius);
            checkDetails(withRadius, MAX_ARTIST_DESCRIPTION);
            lock(listing.getArtistId());
            var moved = !listing.getStartsAt().equals(details.startsAt())
                    || !listing.getEndsAt().equals(details.endsAt());
            if (moved) {
                checkArtistTime(listing.getArtistId(), listing.getId(), withRadius);
            }
            listing.update(withRadius);
        } else {
            checkDetails(details, Integer.MAX_VALUE);
            listing.update(details);
        }
        return view(listing, new Lookups());
    }

    @Transactional
    public ListingView close(UUID userId, UUID listingId) {
        var listing = own(userId, listingId);
        requireActive(listing);
        listing.close(now());
        return view(listing, new Lookups());
    }

    @Transactional(readOnly = true)
    public ListingView get(UUID userId, UUID listingId) {
        return view(own(userId, listingId), new Lookups());
    }

    /** The artist's own listings in every status (or one, by its status as of now). */
    @Transactional(readOnly = true)
    public Page<ListingView> listOfArtist(UUID artistId, ListingStatus status, Pageable pageable) {
        return list((root, query, cb) -> cb.equal(root.get("artistId"), artistId), status, pageable);
    }

    /** Listings of a venue the caller manages, drafts of the venue included. */
    @Transactional(readOnly = true)
    public Page<ListingView> listOfVenue(UUID userId, UUID venueId, ListingStatus status, Pageable pageable) {
        requireMember(userId, venueId);
        return list((root, query, cb) -> cb.equal(root.get("venueId"), venueId), status, pageable);
    }

    // ---- public view

    /** An active listing whose artist profile or venue is published. */
    @Transactional(readOnly = true)
    public ListingView getPublic(UUID listingId) {
        var view = listings.findById(listingId)
                .filter(listing -> listing.isActiveAt(now()))
                .map(listing -> view(listing, new Lookups()))
                .orElseThrow(ListingErrors.ListingNotFound::new);
        if (view.artist() == null && view.venue() == null) {
            throw new ListingErrors.ListingNotFound();
        }
        return view;
    }

    // ---- for other modules and jobs

    @Transactional(readOnly = true)
    public Optional<ActiveListing> findActive(UUID listingId) {
        return listings.findById(listingId).filter(listing -> listing.isActiveAt(now()))
                .map(listing -> new ActiveListing(listing.getId(), listing.getKind(), listing.getArtistId(),
                        listing.getVenueId(), listing.getStartsAt(), listing.getEndsAt(),
                        Set.copyOf(listing.getGenres()), listing.getPriceFrom(), listing.getPriceTo(),
                        listing.getTravelRadiusKm(), listing.getCity(), listing.point()));
    }

    /** Those of the listings that are active now. */
    @Transactional(readOnly = true)
    public Set<UUID> activeAmong(Collection<UUID> listingIds) {
        if (listingIds.isEmpty()) {
            return Set.of();
        }
        var now = now();
        return listings.findAllById(listingIds).stream().filter(listing -> listing.isActiveAt(now))
                .map(Listing::getId).collect(Collectors.toSet());
    }

    /** Active listings near a point, nearest first, at most {@code search.limit()}. */
    @Transactional(readOnly = true)
    public List<NearbyListing> findActiveWithin(ListingSearch search) {
        var center = search.center();
        var anyTime = search.from() == null || search.to() == null;
        var rows = listings.findActiveWithin(center.latitude(), center.longitude(), search.radiusKm() * 1000, now(),
                search.kind() == null, search.kind() == null ? "" : search.kind().name(), anyTime,
                anyTime ? Instant.EPOCH : search.from(), anyTime ? Instant.EPOCH : search.to(),
                search.genres().isEmpty(),
                search.genres().isEmpty() ? List.of("") : search.genres().stream().map(Genre::name).toList(),
                search.budget() == null, search.budget() == null ? 0 : search.budget(), search.limit());
        if (rows.isEmpty()) {
            return List.of();
        }
        var byId = new HashMap<UUID, Listing>();
        listings.findWithGenresByIdIn(rows.stream().map(ListingRepository.NearbyRow::getId).toList())
                .forEach(listing -> byId.put(listing.getId(), listing));
        return rows.stream().filter(row -> byId.containsKey(row.getId()))
                .map(row -> new NearbyListing(card(byId.get(row.getId())), row.getDistance()))
                .toList();
    }

    private static ListingCard card(Listing listing) {
        return new ListingCard(listing.getId(), listing.getKind(), listing.getArtistId(), listing.getVenueId(),
                listing.getStartsAt(), listing.getEndsAt(), Set.copyOf(listing.getGenres()),
                listing.getDescription(), listing.getPriceFrom(), listing.getPriceTo(), listing.getTravelRadiusKm(),
                listing.getCity(), listing.point());
    }

    /** Marks an active listing as taken by a booking; fails with {@code LISTING_NOT_ACTIVE}. */
    @Transactional
    public void markFilled(UUID listingId, UUID bookingId) {
        var listing = listings.findById(listingId).orElseThrow(ListingErrors.ListingNotFound::new);
        requireActive(listing);
        listing.fill(bookingId, now());
    }

    /** Expires the artist's upcoming listings whose time is no longer free in their calendar. */
    @Transactional
    public int expireNotFree(UUID artistId) {
        // Several calendar changes in a row are handled in parallel; one at a time per artist, so each sees the
        // expiries of the others instead of failing on their version.
        lock(artistId);
        var now = now();
        var gone = listings.findUpcomingOfArtist(artistId, now).stream()
                .filter(listing -> !availability.isFree(artistId, listing.getStartsAt(), listing.getEndsAt()))
                .toList();
        gone.forEach(listing -> listing.expire(now));
        return gone.size();
    }

    /** Stores the expiry of active listings that have started; returns how many. */
    @Transactional
    public int expireStarted() {
        return listings.expireStarted(now(), ListingStatus.ACTIVE, ListingStatus.EXPIRED);
    }

    // ---- internals

    private Page<ListingView> list(Specification<Listing> owner, ListingStatus status, Pageable pageable) {
        var lookups = new Lookups();
        var spec = status == null ? owner : owner.and(inStatus(status, now()));
        return listings.findAll(spec, pageable).map(listing -> view(listing, lookups));
    }

    /** Filters by the status as of {@code now}, so started active listings count as expired. */
    private static Specification<Listing> inStatus(ListingStatus status, Instant now) {
        return (root, query, cb) -> {
            Predicate active = cb.equal(root.get("status"), ListingStatus.ACTIVE);
            Predicate started = cb.lessThanOrEqualTo(root.get("startsAt"), now);
            return switch (status) {
                case ACTIVE -> cb.and(active, cb.not(started));
                case EXPIRED -> cb.or(cb.equal(root.get("status"), ListingStatus.EXPIRED), cb.and(active, started));
                default -> cb.equal(root.get("status"), status);
            };
        };
    }

    private void checkDetails(ListingDetails details, int maxDescription) {
        var length = Duration.between(details.startsAt(), details.endsAt());
        if (length.compareTo(MIN_LENGTH) < 0 || length.compareTo(MAX_LENGTH) > 0) {
            throw new ListingErrors.DurationInvalid();
        }
        var now = now();
        if (!details.startsAt().isAfter(now)) {
            throw new ListingErrors.InPast();
        }
        if (details.startsAt().isAfter(now.plus(Duration.ofDays(MAX_DAYS_AHEAD)))) {
            throw new ListingErrors.TooFar(MAX_DAYS_AHEAD);
        }
        if (details.priceFrom() != null && details.priceTo() != null && details.priceFrom() > details.priceTo()) {
            throw new ListingErrors.PriceOrder();
        }
        if (details.description() != null && details.description().length() > maxDescription) {
            throw new ListingErrors.DescriptionTooLong(maxDescription);
        }
    }

    /** The time must be free in the calendar and not announced by another active listing of the artist. */
    private void checkArtistTime(UUID artistId, UUID listingId, ListingDetails details) {
        if (!availability.isFree(artistId, details.startsAt(), details.endsAt())) {
            throw new ListingErrors.NotFree();
        }
        var duplicate = listings.findUpcomingOfArtist(artistId, now()).stream()
                .filter(other -> !other.getId().equals(listingId))
                .anyMatch(other -> other.getStartsAt().isBefore(details.endsAt())
                        && other.getEndsAt().isAfter(details.startsAt()));
        if (duplicate) {
            throw new ListingErrors.Duplicate();
        }
    }

    /** A listing the user may edit: their own as an artist, or one of a venue whose team they are in. */
    private Listing own(UUID userId, UUID listingId) {
        return listings.findById(listingId)
                .filter(listing -> listing.getKind() == ListingKind.ARTIST_AVAILABLE
                        ? userId.equals(listing.getArtistId())
                        : isMember(userId, listing.getVenueId()))
                .orElseThrow(ListingErrors.ListingNotFound::new);
    }

    private void requireActive(Listing listing) {
        if (!listing.isActiveAt(now())) {
            throw new ListingErrors.NotActive();
        }
    }

    private void requireMember(UUID userId, UUID venueId) {
        if (!isMember(userId, venueId)) {
            throw new ListingErrors.VenueNotFound();
        }
    }

    private boolean isMember(UUID userId, UUID venueId) {
        return venues.findManagedBy(userId).stream().anyMatch(member -> member.venueId().equals(venueId));
    }

    private void published(Listing listing) {
        events.publishEvent(new ListingPublished(listing.getId(), listing.getKind(), listing.getArtistId(),
                listing.getVenueId(), listing.getStartsAt(), listing.getEndsAt(), Set.copyOf(listing.getGenres()),
                listing.point()));
    }

    private ListingView view(Listing listing, Lookups lookups) {
        return new ListingView(listing, listing.statusAt(now()), genres(listing),
                listing.getArtistId() == null ? null : lookups.artist(listing.getArtistId()),
                listing.getVenueId() == null ? null : lookups.venue(listing.getVenueId()));
    }

    private static List<Genre> genres(Listing listing) {
        return listing.getGenres().stream().sorted().toList();
    }

    /** One writer per artist or venue at a time, so limits and duplicates hold under concurrent posts. */
    private void lock(UUID id) {
        jdbc.queryForObject("SELECT 1 FROM pg_advisory_xact_lock(?)", Integer.class,
                id.getMostSignificantBits() ^ id.getLeastSignificantBits() ^ LOCK_SALT);
    }

    private Instant now() {
        return clock.instant();
    }

    /** Profiles looked up once per request, since a page of listings mostly shares one author. */
    private final class Lookups {

        private final HashMap<UUID, Optional<ArtistSummary>> artists = new HashMap<>();
        private final HashMap<UUID, Optional<VenueSummary>> venuesById = new HashMap<>();

        ArtistSummary artist(UUID id) {
            return artists.computeIfAbsent(id, artistProfiles::findPublishedByOwner).orElse(null);
        }

        VenueSummary venue(UUID id) {
            return venuesById.computeIfAbsent(id, venues::findPublished).orElse(null);
        }
    }
}
