package pl.spotonslot.booking.application;

import jakarta.persistence.criteria.Predicate;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.spotonslot.artist.ArtistProfiles;
import pl.spotonslot.artist.ArtistSummary;
import pl.spotonslot.availability.Availability;
import pl.spotonslot.booking.BookingAccepted;
import pl.spotonslot.booking.BookingCancelled;
import pl.spotonslot.booking.BookingConversations;
import pl.spotonslot.booking.BookingCountered;
import pl.spotonslot.booking.BookingDeclined;
import pl.spotonslot.booking.BookingExpired;
import pl.spotonslot.booking.BookingInfo;
import pl.spotonslot.booking.BookingParty;
import pl.spotonslot.booking.BookingRequested;
import pl.spotonslot.booking.BookingStatus;
import pl.spotonslot.booking.BookingWithdrawn;
import pl.spotonslot.booking.domain.Booking;
import pl.spotonslot.booking.domain.BookingErrors;
import pl.spotonslot.booking.domain.BookingStepType;
import pl.spotonslot.booking.domain.BookingTerms;
import pl.spotonslot.booking.infrastructure.BookingRepository;
import pl.spotonslot.listing.ActiveListing;
import pl.spotonslot.listing.ListingKind;
import pl.spotonslot.listing.Listings;
import pl.spotonslot.venue.VenueSummary;
import pl.spotonslot.venue.Venues;

/**
 * Requests, applications, counter-offers and answers, the parties' lists and the stored expiry. Every step that
 * touches an artist runs under that artist's lock, so two acceptances cannot both book one evening.
 */
@Service
@RequiredArgsConstructor
public class BookingService {

    public static final int MAX_PENDING_PER_VENUE = 30;
    public static final int MAX_PENDING_APPLICATIONS_PER_ARTIST = 20;
    public static final long MAX_DAYS_AHEAD = 365;
    static final Duration MIN_LENGTH = Duration.ofMinutes(30);
    static final Duration MAX_LENGTH = Duration.ofHours(24);
    /** Keeps booking locks apart from the calendar's and the listings' locks on the same artist id. */
    private static final long LOCK_SALT = 0x424f4f4bL;

    private final BookingRepository bookings;
    private final ArtistProfiles artistProfiles;
    private final Venues venues;
    private final Listings listings;
    private final Availability availability;
    private final ApplicationEventPublisher events;
    private final ObjectProvider<BookingConversations> conversations;
    private final JdbcTemplate jdbc;
    private final Clock clock;

    // ---- starting a booking

    /**
     * A venue's request to an artist, by the artist's address or one of their "I'm free" listings (whose time
     * applies when the request leaves it out). The time must be free in the artist's calendar.
     */
    @Transactional
    public BookingView request(UUID userId, UUID venueId, String artistSlug, UUID listingId, Instant startsAt,
            Instant endsAt, long amount, String message) {
        requireMember(userId, venueId);
        var venue = venues.findPublished(venueId).orElseThrow(BookingErrors.VenueNotPublished::new);
        UUID artistId;
        if (listingId != null) {
            var listing = activeListing(listingId, ListingKind.ARTIST_AVAILABLE);
            artistId = listing.artistId();
            startsAt = startsAt == null ? listing.startsAt() : startsAt;
            endsAt = endsAt == null ? listing.endsAt() : endsAt;
        } else if (artistSlug != null) {
            artistId = artistProfiles.findPublishedBySlug(artistSlug).orElseThrow(BookingErrors.ArtistNotFound::new)
                    .ownerId();
        } else {
            throw new BookingErrors.RequestInvalid();
        }
        if (startsAt == null || endsAt == null) {
            throw new BookingErrors.RequestInvalid();
        }
        var artist = artistProfiles.findPublishedByOwner(artistId).orElseThrow(BookingErrors.ArtistNotFound::new);
        var terms = new BookingTerms(startsAt, endsAt, amount, message);
        checkTerms(terms);
        lock(artistId);
        if (bookings.countPendingOfVenue(venueId, now()) >= MAX_PENDING_PER_VENUE) {
            throw new BookingErrors.LimitReached(MAX_PENDING_PER_VENUE);
        }
        checkNoDuplicate(artistId, venueId, terms);
        if (!availability.isFree(artistId, startsAt, endsAt)) {
            throw new BookingErrors.NotFree();
        }
        var booking = bookings.save(Booking.request(artistId, venueId, listingId, BookingParty.VENUE, userId,
                artist.stageName(), venue.name(), terms, now()));
        events.publishEvent(new BookingRequested(booking.getId(), artistId, venueId, startsAt, endsAt,
                BookingParty.VENUE, userId));
        return view(booking, BookingParty.VENUE, new Lookups());
    }

    /** An artist's application to a venue's "looking for an artist" listing, for the listing's time. */
    @Transactional
    public BookingView apply(UUID artistId, UUID listingId, long amount, String message) {
        if (listingId == null) {
            throw new BookingErrors.RequestInvalid();
        }
        var artist = artistProfiles.findPublishedByOwner(artistId).orElseThrow(BookingErrors.ProfileRequired::new);
        var listing = activeListing(listingId, ListingKind.VENUE_SEEKING);
        var venue = venues.findPublished(listing.venueId()).orElseThrow(BookingErrors.ListingNotFound::new);
        var terms = new BookingTerms(listing.startsAt(), listing.endsAt(), amount, message);
        checkTerms(terms);
        lock(artistId);
        if (bookings.countPendingApplicationsOfArtist(artistId, now()) >= MAX_PENDING_APPLICATIONS_PER_ARTIST) {
            throw new BookingErrors.LimitReached(MAX_PENDING_APPLICATIONS_PER_ARTIST);
        }
        checkNoDuplicate(artistId, venue.id(), terms);
        if (availability.isBooked(artistId, terms.startsAt(), terms.endsAt())) {
            throw new BookingErrors.NotFree();
        }
        var booking = bookings.save(Booking.request(artistId, venue.id(), listingId, BookingParty.ARTIST, artistId,
                artist.stageName(), venue.name(), terms, now()));
        events.publishEvent(new BookingRequested(booking.getId(), artistId, venue.id(), terms.startsAt(),
                terms.endsAt(), BookingParty.ARTIST, artistId));
        return view(booking, BookingParty.ARTIST, new Lookups());
    }

    // ---- answers

    /** New terms from the side whose turn it is; the turn passes to the other side. */
    @Transactional
    public BookingView counter(UUID userId, UUID bookingId, BookingTerms terms) {
        var booking = locked(bookingId);
        var party = partyOf(userId, booking);
        requireTurn(booking, party);
        checkTerms(terms);
        checkProposalTime(booking, party, terms);
        booking.counter(party, userId, terms, now());
        events.publishEvent(new BookingCountered(booking.getId(), booking.getArtistId(), booking.getVenueId(),
                terms.startsAt(), terms.endsAt(), party, userId));
        return view(booking, party, new Lookups());
    }

    /**
     * Accepts the current proposal (it must be {@code revision}) and books the artist's time; other pending
     * bookings of the artist overlapping it are declined, and the listing it answered is filled.
     */
    @Transactional
    public BookingView accept(UUID userId, UUID bookingId, int revision) {
        var booking = locked(bookingId);
        var party = partyOf(userId, booking);
        requireTurn(booking, party);
        if (booking.getRevision() != revision) {
            throw new BookingErrors.Stale();
        }
        var now = now();
        if (!availability.hold(booking.getArtistId(), booking.getStartsAt(), booking.getEndsAt(), booking.getId())) {
            throw new BookingErrors.CalendarConflict();
        }
        booking.accept(party, userId, now);
        events.publishEvent(new BookingAccepted(booking.getId(), booking.getArtistId(), booking.getVenueId(),
                booking.getStartsAt(), booking.getEndsAt(), party, userId));
        bookings.findPendingOfArtistBetween(booking.getArtistId(), booking.getStartsAt(), booking.getEndsAt(), now)
                .stream()
                .filter(other -> !other.getId().equals(booking.getId()))
                .forEach(other -> {
                    other.decline(BookingParty.SYSTEM, null, null, now);
                    events.publishEvent(new BookingDeclined(other.getId(), other.getArtistId(), other.getVenueId(),
                            other.getStartsAt(), other.getEndsAt(), BookingParty.SYSTEM, null));
                });
        if (booking.getListingId() != null && listings.findActive(booking.getListingId()).isPresent()) {
            listings.markFilled(booking.getListingId(), booking.getId());
        }
        return view(booking, party, new Lookups());
    }

    @Transactional
    public BookingView decline(UUID userId, UUID bookingId, String reason) {
        var booking = locked(bookingId);
        var party = partyOf(userId, booking);
        requireTurn(booking, party);
        booking.decline(party, userId, reason, now());
        events.publishEvent(new BookingDeclined(booking.getId(), booking.getArtistId(), booking.getVenueId(),
                booking.getStartsAt(), booking.getEndsAt(), party, userId));
        return view(booking, party, new Lookups());
    }

    /** Takes back the caller's side's latest proposal while the other side has not answered. */
    @Transactional
    public BookingView withdraw(UUID userId, UUID bookingId) {
        var booking = locked(bookingId);
        var party = partyOf(userId, booking);
        requirePending(booking);
        if (booking.proposer() != party) {
            throw new BookingErrors.NotYourTurn();
        }
        booking.withdraw(party, userId, now());
        events.publishEvent(new BookingWithdrawn(booking.getId(), booking.getArtistId(), booking.getVenueId(),
                booking.getStartsAt(), booking.getEndsAt(), party, userId));
        return view(booking, party, new Lookups());
    }

    /** Cancels an accepted booking before it starts; the time is free in the calendar again. */
    @Transactional
    public BookingView cancel(UUID userId, UUID bookingId, String reason) {
        var booking = locked(bookingId);
        var party = partyOf(userId, booking);
        if (booking.statusAt(now()) != BookingStatus.ACCEPTED) {
            throw new BookingErrors.Closed();
        }
        if (!booking.getStartsAt().isAfter(now())) {
            throw new BookingErrors.Started();
        }
        availability.release(booking.getId());
        booking.cancel(party, userId, reason, now());
        events.publishEvent(new BookingCancelled(booking.getId(), booking.getArtistId(), booking.getVenueId(),
                booking.getStartsAt(), booking.getEndsAt(), party, userId));
        return view(booking, party, new Lookups());
    }

    // ---- reading

    @Transactional(readOnly = true)
    public BookingView get(UUID userId, UUID bookingId) {
        var booking = bookings.findById(bookingId).orElseThrow(BookingErrors.BookingNotFound::new);
        return view(booking, partyOf(userId, booking), new Lookups());
    }

    /**
     * The caller's bookings: as the artist, and for every venue whose team they are in ({@code venueId} narrows it
     * to one of them). {@code status} filters by the status as of now; {@code awaitingMe} keeps those waiting for
     * the caller's answer.
     */
    @Transactional(readOnly = true)
    public Page<BookingView> list(UUID userId, BookingFilter filter, Pageable pageable) {
        var myVenues = venues.findManagedBy(userId).stream().map(member -> member.venueId())
                .collect(Collectors.toSet());
        if (filter.venueId() != null && !myVenues.contains(filter.venueId())) {
            throw new BookingErrors.VenueNotFound();
        }
        var scope = filter.venueId() != null ? Set.of(filter.venueId()) : myVenues;
        var now = now();
        Specification<Booking> spec = (root, query, cb) -> {
            var predicates = new ArrayList<Predicate>();
            var mine = filter.venueId() != null
                    ? root.get("venueId").in(scope)
                    : scope.isEmpty()
                            ? cb.equal(root.get("artistId"), userId)
                            : cb.or(cb.equal(root.get("artistId"), userId), root.get("venueId").in(scope));
            predicates.add(mine);
            if (!filter.statuses().isEmpty()) {
                predicates.add(cb.or(filter.statuses().stream()
                        .map(status -> inStatus(root, cb, status, now)).toArray(Predicate[]::new)));
            }
            if (filter.from() != null) {
                predicates.add(cb.greaterThan(root.get("endsAt"), filter.from()));
            }
            if (filter.to() != null) {
                predicates.add(cb.lessThan(root.get("startsAt"), filter.to()));
            }
            if (filter.awaitingMe()) {
                predicates.add(inStatus(root, cb, BookingStatus.PENDING, now));
                var asArtist = cb.and(cb.equal(root.get("artistId"), userId),
                        cb.equal(root.get("awaiting"), BookingParty.ARTIST));
                predicates.add(scope.isEmpty() ? asArtist
                        : cb.or(asArtist, cb.and(root.get("venueId").in(scope),
                                cb.equal(root.get("awaiting"), BookingParty.VENUE))));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
        var page = bookings.findAll(spec, pageable);
        var lookups = new Lookups();
        lookups.prefetchConversations(page.getContent().stream().map(Booking::getId).toList());
        return page.map(booking -> view(booking,
                userId.equals(booking.getArtistId()) ? BookingParty.ARTIST : BookingParty.VENUE, lookups));
    }

    // ---- for other modules and jobs

    @Transactional(readOnly = true)
    public boolean venueHasAcceptedBetween(UUID venueId, Instant from, Instant to) {
        return bookings.existsAcceptedOfVenueBetween(venueId, from, to);
    }

    @Transactional(readOnly = true)
    public Optional<BookingInfo> find(UUID bookingId) {
        return bookings.findById(bookingId).map(booking -> new BookingInfo(booking.getId(), booking.getArtistId(),
                booking.getVenueId(), booking.getStartsAt(), booking.getEndsAt(), booking.statusAt(now()),
                booking.getArtistStageName(), booking.getVenueName(), booking.getAmount()));
    }

    /** Stores the expiry of unanswered and started requests and the completion of played bookings. */
    @Transactional
    public int storeTimedOut() {
        var now = now();
        var timedOut = bookings.findTimedOut(now);
        for (var booking : timedOut) {
            var expired = booking.statusAt(now) == BookingStatus.EXPIRED;
            booking.storeTimedOut(now);
            if (expired) {
                events.publishEvent(new BookingExpired(booking.getId(), booking.getArtistId(), booking.getVenueId(),
                        booking.getStartsAt(), booking.getEndsAt(), BookingParty.SYSTEM, null));
            }
        }
        return timedOut.size();
    }

    // ---- internals

    /** Filters by the status as of {@code now}, as {@link Booking#statusAt} reads it. */
    private static Predicate inStatus(jakarta.persistence.criteria.Root<Booking> root,
            jakarta.persistence.criteria.CriteriaBuilder cb, BookingStatus status, Instant now) {
        var pending = cb.equal(root.get("status"), BookingStatus.PENDING);
        var unanswered = cb.or(cb.lessThanOrEqualTo(root.get("respondBy"), now),
                cb.lessThanOrEqualTo(root.get("startsAt"), now));
        var accepted = cb.equal(root.get("status"), BookingStatus.ACCEPTED);
        var ended = cb.lessThanOrEqualTo(root.get("endsAt"), now);
        return switch (status) {
            case PENDING -> cb.and(pending, cb.not(unanswered));
            case EXPIRED -> cb.or(cb.equal(root.get("status"), BookingStatus.EXPIRED), cb.and(pending, unanswered));
            case ACCEPTED -> cb.and(accepted, cb.not(ended));
            case COMPLETED -> cb.or(cb.equal(root.get("status"), BookingStatus.COMPLETED), cb.and(accepted, ended));
            default -> cb.equal(root.get("status"), status);
        };
    }

    private void checkTerms(BookingTerms terms) {
        var length = Duration.between(terms.startsAt(), terms.endsAt());
        if (length.compareTo(MIN_LENGTH) < 0 || length.compareTo(MAX_LENGTH) > 0) {
            throw new BookingErrors.DurationInvalid();
        }
        var now = now();
        if (!terms.startsAt().isAfter(now)) {
            throw new BookingErrors.InPast();
        }
        if (terms.startsAt().isAfter(now.plus(Duration.ofDays(MAX_DAYS_AHEAD)))) {
            throw new BookingErrors.TooFar(MAX_DAYS_AHEAD);
        }
    }

    /**
     * A venue proposes time free in the artist's calendar, except on the artist's application to the venue's own
     * listing; an artist proposes any time not already booked.
     */
    private void checkProposalTime(Booking booking, BookingParty party, BookingTerms terms) {
        var free = party == BookingParty.VENUE && booking.getInitiator() == BookingParty.VENUE
                ? availability.isFree(booking.getArtistId(), terms.startsAt(), terms.endsAt())
                : !availability.isBooked(booking.getArtistId(), terms.startsAt(), terms.endsAt());
        if (!free) {
            throw new BookingErrors.NotFree();
        }
    }

    /** One venue waits on one artist for one time at most once. */
    private void checkNoDuplicate(UUID artistId, UUID venueId, BookingTerms terms) {
        var duplicate = bookings.findPendingOfArtistBetween(artistId, terms.startsAt(), terms.endsAt(), now())
                .stream().anyMatch(other -> other.getVenueId().equals(venueId));
        if (duplicate) {
            throw new BookingErrors.Duplicate();
        }
    }

    private ActiveListing activeListing(UUID listingId, ListingKind kind) {
        return listings.findActive(listingId).filter(listing -> listing.kind() == kind)
                .orElseThrow(BookingErrors.ListingNotFound::new);
    }

    /** The booking read under its artist's lock, so it reflects every step that finished before. */
    private Booking locked(UUID bookingId) {
        var artistId = bookings.findArtistId(bookingId).orElseThrow(BookingErrors.BookingNotFound::new);
        lock(artistId);
        return bookings.findById(bookingId).orElseThrow(BookingErrors.BookingNotFound::new);
    }

    /** The caller's side of the booking; anybody else gets 404. */
    private BookingParty partyOf(UUID userId, Booking booking) {
        if (userId.equals(booking.getArtistId())) {
            return BookingParty.ARTIST;
        }
        if (isMember(userId, booking.getVenueId())) {
            return BookingParty.VENUE;
        }
        throw new BookingErrors.BookingNotFound();
    }

    private void requirePending(Booking booking) {
        if (booking.statusAt(now()) != BookingStatus.PENDING) {
            throw new BookingErrors.Closed();
        }
    }

    private void requireTurn(Booking booking, BookingParty party) {
        requirePending(booking);
        if (booking.awaitingAt(now()) != party) {
            throw new BookingErrors.NotYourTurn();
        }
    }

    private void requireMember(UUID userId, UUID venueId) {
        if (venueId == null || !isMember(userId, venueId)) {
            throw new BookingErrors.VenueNotFound();
        }
    }

    private boolean isMember(UUID userId, UUID venueId) {
        return venues.findManagedBy(userId).stream().anyMatch(member -> member.venueId().equals(venueId));
    }

    private BookingView view(Booking booking, BookingParty viewer, Lookups lookups) {
        var now = now();
        var status = booking.statusAt(now);
        var steps = new ArrayList<BookingView.Step>();
        booking.getSteps().forEach(step -> steps.add(new BookingView.Step(step.getType(), step.getParty(),
                viewer == step.getParty(), step.getAt(), step.getStartsAt(), step.getEndsAt(),
                step.getAmount(), step.getMessage())));
        // A time-based status reads before the job stores its step.
        var stored = booking.getSteps().getLast().getType();
        var timedOut = status == BookingStatus.EXPIRED ? BookingStepType.EXPIRED
                : status == BookingStatus.COMPLETED ? BookingStepType.COMPLETED : null;
        if (timedOut != null && stored != timedOut) {
            steps.add(new BookingView.Step(timedOut, BookingParty.SYSTEM, false, booking.timedOutAt(),
                    booking.getStartsAt(), booking.getEndsAt(), booking.getAmount(), null));
        }
        var artist = lookups.artist(booking.getArtistId());
        var venue = lookups.venue(booking.getVenueId());
        return new BookingView(booking, status, booking.awaitingAt(now), viewer, booking.proposer(),
                artist == null ? null : artist.slug(), venue == null ? null : venue.slug(),
                booking.terms().message(), lookups.conversation(booking.getId()), List.copyOf(steps));
    }

    /** One writer per artist at a time. */
    private void lock(UUID artistId) {
        jdbc.queryForObject("SELECT 1 FROM pg_advisory_xact_lock(?)", Integer.class,
                artistId.getMostSignificantBits() ^ artistId.getLeastSignificantBits() ^ LOCK_SALT);
    }

    private Instant now() {
        return clock.instant();
    }

    /** Published profiles looked up once per request, since a page of bookings mostly shares one side. */
    private final class Lookups {

        private final HashMap<UUID, Optional<ArtistSummary>> artists = new HashMap<>();
        private final HashMap<UUID, Optional<VenueSummary>> venuesById = new HashMap<>();
        private final HashMap<UUID, Optional<UUID>> threads = new HashMap<>();

        ArtistSummary artist(UUID id) {
            return artists.computeIfAbsent(id, artistProfiles::findPublishedByOwner).orElse(null);
        }

        VenueSummary venue(UUID id) {
            return venuesById.computeIfAbsent(id, venues::findPublished).orElse(null);
        }

        /** The booking's conversation thread; null until messaging opened it (or without the messaging module). */
        UUID conversation(UUID bookingId) {
            if (!threads.containsKey(bookingId)) {
                prefetchConversations(List.of(bookingId));
            }
            return threads.get(bookingId).orElse(null);
        }

        void prefetchConversations(List<UUID> bookingIds) {
            var provider = conversations.getIfAvailable();
            var found = provider == null || bookingIds.isEmpty() ? Map.<UUID, UUID>of()
                    : provider.conversationsOf(bookingIds);
            bookingIds.forEach(id -> threads.put(id, Optional.ofNullable(found.get(id))));
        }
    }
}
