package pl.spotonslot.venue;

import java.util.Collection;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.spotonslot.artist.Genre;
import pl.spotonslot.location.GeoPoint;
import pl.spotonslot.venue.application.VenueAccountService;
import pl.spotonslot.venue.application.VenueService;
import pl.spotonslot.venue.domain.Venue;
import pl.spotonslot.venue.infrastructure.VenueRepository;

/** The module's facade for other modules. */
@Service
@RequiredArgsConstructor
public class Venues {

    public static final double MIN_RADIUS_KM = 1;
    public static final double MAX_RADIUS_KM = 500;
    public static final int MAX_RESULTS = 1000;

    /** Stands in for an empty list in native {@code IN (...)}, which SQL does not allow empty. */
    private static final List<String> NONE = List.of("");

    private final VenueService venues;
    private final VenueRepository repository;
    private final VenueAccountService accounts;

    /** The venues a person is in the team of, with their role; drafts included. */
    public List<VenueMembership> findManagedBy(UUID userId) {
        return venues.membershipsOf(userId).stream()
                .map(member -> new VenueMembership(member.getVenueId(), member.getRole()))
                .toList();
    }

    /** Venues whose team is the user alone (they go with the user's account). */
    public Set<UUID> soleMemberVenues(UUID userId) {
        return accounts.soleMemberVenues(userId);
    }

    /** The team (user ids) of each of the venues; venues without a team are left out. */
    @Transactional(readOnly = true)
    public Map<UUID, Set<UUID>> teamsOf(Collection<UUID> venueIds) {
        var teams = new HashMap<UUID, Set<UUID>>();
        if (!venueIds.isEmpty()) {
            venues.membersOf(venueIds).forEach(member -> teams
                    .computeIfAbsent(member.getVenueId(), id -> new LinkedHashSet<>()).add(member.getUserId()));
        }
        return teams;
    }

    /** A published venue; drafts are invisible to other modules. Published venues always have a point. */
    public Optional<VenueSummary> findPublished(UUID venueId) {
        return venues.findPublished(venueId).flatMap(venue -> venue.address().flatMap(address -> address.point()
                .map(point -> new VenueSummary(venue.getId(), venue.getSlug(), venue.getName(), address.city(),
                        point))));
    }

    /** A published venue by its public address. */
    public Optional<VenueSummary> findPublishedBySlug(String slug) {
        return venues.findPublishedBySlug(slug).flatMap(venue -> findPublished(venue.getId()));
    }

    /** Cards of those of the venues that are published, in no particular order. */
    public List<VenueCard> findPublishedCards(Collection<UUID> venueIds) {
        return venues.findPublished(venueIds).stream().flatMap(venue -> card(venue).stream()).toList();
    }

    /**
     * Published venues within {@code radiusKm} of {@code center}, nearest first (then by name), of any of
     * {@code types} and with any of {@code genres}; an empty set does not filter.
     *
     * @throws IllegalArgumentException for a radius outside 1–500 km or a limit outside 1–1000
     */
    @Transactional(readOnly = true)
    public List<NearbyVenue> findPublishedWithin(GeoPoint center, double radiusKm, Set<Genre> genres,
            Set<VenueType> types, int limit) {
        if (!(radiusKm >= MIN_RADIUS_KM && radiusKm <= MAX_RADIUS_KM)) {
            throw new IllegalArgumentException("Radius must be between 1 and 500 km: " + radiusKm);
        }
        if (limit < 1 || limit > MAX_RESULTS) {
            throw new IllegalArgumentException("Limit must be between 1 and 1000: " + limit);
        }
        var rows = repository.findPublishedWithin(center.latitude(), center.longitude(), radiusKm * 1000,
                types.isEmpty(), names(types), genres.isEmpty(), names(genres), limit);
        var byId = new HashMap<UUID, Venue>();
        venues.findPublished(rows.stream().map(VenueRepository.NearbyRow::getId).toList())
                .forEach(venue -> byId.put(venue.getId(), venue));
        return rows.stream()
                .flatMap(row -> Optional.ofNullable(byId.get(row.getId())).flatMap(Venues::card).stream()
                        .map(card -> new NearbyVenue(card, row.getDistance())))
                .toList();
    }

    private static Optional<VenueCard> card(Venue venue) {
        return venue.address().flatMap(address -> address.point().map(point -> new VenueCard(venue.getId(),
                venue.getSlug(), venue.getName(), venue.getType(), address.city(),
                venue.getGenres().isEmpty() ? EnumSet.noneOf(Genre.class) : EnumSet.copyOf(venue.getGenres()),
                venue.getCapacity(), venue.getAvatarMediaId(), point)));
    }

    private static List<String> names(Set<? extends Enum<?>> values) {
        return values.isEmpty() ? NONE : values.stream().map(Enum::name).toList();
    }
}
