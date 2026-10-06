package pl.spotonslot.venue.application;

import java.time.Clock;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.hibernate.Hibernate;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import pl.spotonslot.location.GeocodedAddress;
import pl.spotonslot.location.Locations;
import pl.spotonslot.media.MediaLibrary;
import pl.spotonslot.shared.text.Slugs;
import pl.spotonslot.venue.VenueRole;
import pl.spotonslot.venue.domain.Address;
import pl.spotonslot.venue.domain.Venue;
import pl.spotonslot.venue.domain.VenueDetails;
import pl.spotonslot.venue.domain.VenueErrors;
import pl.spotonslot.venue.domain.VenueMember;
import pl.spotonslot.venue.infrastructure.VenueMemberRepository;
import pl.spotonslot.venue.infrastructure.VenueRepository;

/**
 * Venue profiles: creating, saving, the public address, publication. Geocoding runs before the transaction, so a
 * slow geocoder never holds a database connection.
 */
@Service
@RequiredArgsConstructor
public class VenueService {

    /** What publishing needs, in the order clients should ask for it. */
    public enum Requirement {
        NAME,
        TYPE,
        ADDRESS,
        GENRE,
        AVATAR
    }

    private static final int MAX_SLUG_ATTEMPTS = 50;
    private static final String SLUG_FALLBACK = "venue";

    private final VenueRepository venues;
    private final VenueMemberRepository members;
    private final VenueAccess access;
    private final MediaLibrary mediaLibrary;
    private final Locations locations;
    private final TransactionTemplate transaction;
    private final Clock clock;

    /** The caller's venues with their role, oldest membership first. */
    @Transactional(readOnly = true)
    public List<ManagedVenue> listMine(UUID userId) {
        var memberships = members.findByUserIdOrderByCreatedAtAsc(userId);
        var byId = venues.findByIdIn(memberships.stream().map(VenueMember::getVenueId).toList()).stream()
                .collect(Collectors.toMap(Venue::getId, Function.identity()));
        return memberships.stream()
                .filter(member -> byId.containsKey(member.getVenueId()))
                .map(member -> new ManagedVenue(loaded(byId.get(member.getVenueId())), member.getRole()))
                .toList();
    }

    /** A new draft venue; its creator becomes the owner. {@code slug == null} derives the address from the name. */
    public ManagedVenue create(UUID userId, VenueDetails details, String slug, Locale locale) {
        if (members.countByUserId(userId) >= Venue.MAX_PER_USER) {
            throw new VenueErrors.LimitReached();
        }
        checkMedia(userId, details, List.of());
        if (slug != null) {
            checkRequestedSlug(slug);
        }
        var located = locate(details, null, locale);
        return inTransaction(() -> {
            var venue = Venue.create(slug != null ? claim(slug, null) : freeSlug(located.name()), located);
            venues.saveAndFlush(venue);
            members.saveAndFlush(VenueMember.of(venue.getId(), userId, VenueRole.OWNER));
            return new ManagedVenue(loaded(venue), VenueRole.OWNER);
        });
    }

    @Transactional(readOnly = true)
    public ManagedVenue get(UUID userId, UUID venueId) {
        var member = access.member(venueId, userId);
        return new ManagedVenue(loaded(find(venueId)), member.getRole());
    }

    /**
     * Replaces the profile. Photos already on the venue stay whoever added them; newly added ones must belong to the
     * person saving. {@code slug == null} keeps the current address.
     */
    public ManagedVenue save(UUID userId, UUID venueId, VenueDetails details, String slug, Locale locale) {
        // A self-call skips @Transactional, so the read gets its own transaction.
        var current = transaction.execute(status -> get(userId, venueId)).venue();
        checkMedia(userId, details, current.mediaIds());
        if (slug != null) {
            checkRequestedSlug(slug);
        }
        var located = locate(details, current.address().orElse(null), locale);
        return inTransaction(() -> {
            var member = access.member(venueId, userId);
            var venue = find(venueId);
            if (slug != null && !slug.equals(venue.getSlug())) {
                venue.changeSlug(claim(slug, venue.getId()));
            }
            venue.update(located);
            return new ManagedVenue(loaded(venues.saveAndFlush(venue)), member.getRole());
        });
    }

    /** What is still missing before {@link #publish} succeeds; empty when the venue can be published. */
    public List<Requirement> missingForPublication(Venue venue) {
        var missing = new ArrayList<Requirement>();
        if (venue.getName() == null || venue.getName().isBlank()) {
            missing.add(Requirement.NAME);
        }
        if (venue.getType() == null) {
            missing.add(Requirement.TYPE);
        }
        if (venue.address().flatMap(Address::point).isEmpty()) {
            missing.add(Requirement.ADDRESS);
        }
        if (venue.getGenres().isEmpty()) {
            missing.add(Requirement.GENRE);
        }
        if (venue.avatar().isEmpty()) {
            missing.add(Requirement.AVATAR);
        }
        return missing;
    }

    @Transactional
    public ManagedVenue publish(UUID userId, UUID venueId) {
        var member = access.owner(venueId, userId);
        var venue = loaded(find(venueId));
        if (!missingForPublication(venue).isEmpty()) {
            throw new VenueErrors.ProfileIncomplete();
        }
        venue.publish(clock.instant());
        return new ManagedVenue(venue, member.getRole());
    }

    @Transactional
    public ManagedVenue unpublish(UUID userId, UUID venueId) {
        var member = access.owner(venueId, userId);
        var venue = loaded(find(venueId));
        venue.unpublish();
        return new ManagedVenue(venue, member.getRole());
    }

    /** Deletes the venue with its team and invitations; its photos stay in their owners' libraries. */
    @Transactional
    public void delete(UUID userId, UUID venueId) {
        access.owner(venueId, userId);
        venues.deleteById(venueId);
    }

    /**
     * Throws when {@code slug} is reserved or used by another venue; {@code venueId} names the venue being edited,
     * whose own address counts as free.
     */
    @Transactional(readOnly = true)
    public void checkSlugAvailable(String slug, UUID venueId) {
        checkRequestedSlug(slug);
        claim(slug, venueId);
    }

    /** A published venue by its public address; drafts do not exist for the public. */
    @Transactional(readOnly = true)
    public Venue getPublished(String slug) {
        return loaded(venues.findBySlug(slug).filter(Venue::isPublished).orElseThrow(VenueErrors.VenueNotFound::new));
    }

    @Transactional(readOnly = true)
    public Optional<Venue> findPublished(UUID venueId) {
        return venues.findById(venueId).filter(Venue::isPublished);
    }

    /** Published venues of the ids, genres loaded, in no particular order. */
    @Transactional(readOnly = true)
    public List<Venue> findPublished(Collection<UUID> venueIds) {
        return venueIds.isEmpty() ? List.of() : venues.findPublishedByIdIn(venueIds);
    }

    @Transactional(readOnly = true)
    public List<VenueMember> membershipsOf(UUID userId) {
        return members.findByUserIdOrderByCreatedAtAsc(userId);
    }

    public List<VenueMember> membersOf(Collection<UUID> venueIds) {
        return members.findByVenueIdIn(venueIds);
    }

    /** Called when an image is deleted in the media module. */
    @Transactional
    public void forgetMedia(UUID mediaId) {
        venues.findUsingMedia(mediaId).forEach(venue -> venue.forgetMedia(mediaId));
    }

    private Venue find(UUID venueId) {
        return venues.findById(venueId).orElseThrow(VenueErrors.VenueNotFound::new);
    }

    private void checkMedia(UUID userId, VenueDetails details, List<UUID> alreadyShown) {
        var kept = new HashSet<>(alreadyShown);
        var added = Stream.concat(Stream.ofNullable(details.avatarMediaId()), details.photoMediaIds().stream())
                .filter(id -> !kept.contains(id))
                .toList();
        if (!added.isEmpty() && !mediaLibrary.ownsAll(userId, added)) {
            throw new VenueErrors.MediaNotOwned();
        }
    }

    /**
     * Fills in the address point: a point picked from a suggestion wins, an unchanged address keeps its point,
     * otherwise the geocoder looks the address up (no match leaves the point empty).
     */
    private VenueDetails locate(VenueDetails details, Address current, Locale locale) {
        var address = details.address();
        if (address == null || address.point().isPresent()) {
            return details;
        }
        if (address.sameTextAs(current) && current.point().isPresent()) {
            return details.withAddress(current);
        }
        var point = locations.geocodeAddress(address.query(), locale).map(GeocodedAddress::point).orElse(null);
        return details.withAddress(Address.of(address.street(), address.postalCode(), address.city(), point));
    }

    private <T> T inTransaction(Supplier<T> work) {
        try {
            return transaction.execute(status -> work.get());
        } catch (DataIntegrityViolationException e) {
            // Two saves raced on the slug or the membership.
            throw new VenueErrors.ConcurrentUpdate();
        }
    }

    /** Venues leave the transaction for mapping (open-in-view is off), so their collections load here. */
    static Venue loaded(Venue venue) {
        Hibernate.initialize(venue.getGenres());
        Hibernate.initialize(venue.getTags());
        Hibernate.initialize(venue.getLinks());
        Hibernate.initialize(venue.getPhotoMediaIds());
        return venue;
    }

    private void checkRequestedSlug(String slug) {
        // The format is checked by bean validation in the API.
        if (Slugs.isReserved(slug)) {
            throw new VenueErrors.SlugReserved();
        }
    }

    private String claim(String slug, UUID venueId) {
        var existing = venues.findBySlug(slug);
        if (existing.isPresent() && !existing.get().getId().equals(venueId)) {
            throw new VenueErrors.SlugTaken();
        }
        return slug;
    }

    private String freeSlug(String name) {
        var base = Slugs.fromName(name, SLUG_FALLBACK);
        for (var attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
            var candidate = Slugs.candidate(base, attempt);
            if (!venues.existsBySlug(candidate)) {
                return candidate;
            }
        }
        return Slugs.candidate(base, ThreadLocalRandom.current().nextInt(1000, 10000));
    }
}
