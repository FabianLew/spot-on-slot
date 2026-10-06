package pl.spotonslot.artist.application;

import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.hibernate.Hibernate;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import pl.spotonslot.artist.domain.ArtistDetails;
import pl.spotonslot.artist.domain.ArtistErrors;
import pl.spotonslot.artist.domain.ArtistProfile;
import pl.spotonslot.artist.infrastructure.ArtistProfileRepository;
import pl.spotonslot.location.Locations;
import pl.spotonslot.media.MediaLibrary;
import pl.spotonslot.shared.text.Slugs;

/** Artists' own profiles: saving, the public address, publication. */
@Service
@RequiredArgsConstructor
public class ArtistProfileService {

    /** What publishing needs, in the order clients should ask for it. */
    public enum Requirement {
        STAGE_NAME,
        GENRE,
        AVATAR,
        LOCATION
    }

    private static final int MAX_SLUG_ATTEMPTS = 50;

    private final ArtistProfileRepository profiles;
    private final MediaLibrary mediaLibrary;
    private final Locations locations;
    private final TransactionTemplate transaction;
    private final Clock clock;

    @Transactional(readOnly = true)
    public ArtistProfile getForOwner(UUID ownerId) {
        return loaded(profiles.findByOwnerId(ownerId).orElseThrow(ArtistErrors.ProfileNotFound::new));
    }

    /**
     * Creates or replaces the profile. A new profile gets an address from its stage name unless {@code slug} asks
     * for one; {@code slug == null} keeps the current address of an existing profile.
     */
    public ArtistProfile save(UUID ownerId, ArtistDetails details, String slug) {
        if (details.rateFrom() != null && details.rateTo() != null && details.rateFrom() > details.rateTo()) {
            throw new ArtistErrors.RateRangeInvalid();
        }
        var media = Stream.concat(Stream.ofNullable(details.avatarMediaId()), details.photoMediaIds().stream())
                .toList();
        if (!media.isEmpty() && !mediaLibrary.ownsAll(ownerId, media)) {
            throw new ArtistErrors.MediaNotOwned();
        }
        if (slug != null) {
            checkRequestedSlug(slug);
        }
        try {
            return transaction.execute(status -> {
                var profile = profiles.findByOwnerId(ownerId).orElse(null);
                if (profile == null) {
                    profile = ArtistProfile.create(ownerId,
                            slug != null ? claim(slug, null) : freeSlug(details.stageName()));
                } else if (slug != null && !slug.equals(profile.getSlug())) {
                    profile.changeSlug(claim(slug, profile.getId()));
                }
                profile.update(details);
                return loaded(profiles.saveAndFlush(profile));
            });
        } catch (DataIntegrityViolationException e) {
            throw new ArtistErrors.ConcurrentUpdate();
        }
    }

    /** What is still missing before {@link #publish} succeeds; empty when the profile can be published. */
    @Transactional(readOnly = true)
    public List<Requirement> missingForPublication(ArtistProfile profile) {
        var missing = new ArrayList<Requirement>();
        if (profile.getStageName() == null || profile.getStageName().isBlank()) {
            missing.add(Requirement.STAGE_NAME);
        }
        if (profile.getGenres().isEmpty()) {
            missing.add(Requirement.GENRE);
        }
        if (profile.avatar().isEmpty()) {
            missing.add(Requirement.AVATAR);
        }
        if (locations.findForUser(profile.getOwnerId()).isEmpty()) {
            missing.add(Requirement.LOCATION);
        }
        return missing;
    }

    @Transactional
    public ArtistProfile publish(UUID ownerId) {
        var profile = getForOwner(ownerId);
        if (!missingForPublication(profile).isEmpty()) {
            throw new ArtistErrors.ProfileIncomplete();
        }
        profile.publish(clock.instant());
        return profile;
    }

    @Transactional
    public ArtistProfile unpublish(UUID ownerId) {
        var profile = getForOwner(ownerId);
        profile.unpublish();
        return profile;
    }

    /** Throws when {@code slug} is invalid, reserved or used by another profile. */
    @Transactional(readOnly = true)
    public void checkSlugAvailable(UUID ownerId, String slug) {
        checkRequestedSlug(slug);
        var owner = profiles.findBySlug(slug).map(ArtistProfile::getOwnerId);
        if (owner.isPresent() && !owner.get().equals(ownerId)) {
            throw new ArtistErrors.SlugTaken();
        }
    }

    /** A published profile by its public address; drafts do not exist for the public. */
    @Transactional(readOnly = true)
    public ArtistProfile getPublished(String slug) {
        return loaded(profiles.findBySlug(slug).filter(ArtistProfile::isPublished)
                .orElseThrow(ArtistErrors.ProfileNotFound::new));
    }

    @Transactional(readOnly = true)
    public Optional<ArtistProfile> findPublishedByOwner(UUID ownerId) {
        return profiles.findByOwnerId(ownerId).filter(ArtistProfile::isPublished);
    }

    /** Called when an image is deleted in the media module. */
    @Transactional
    public void forgetMedia(UUID mediaId) {
        profiles.findUsingMedia(mediaId).forEach(profile -> profile.forgetMedia(mediaId));
    }

    /** Profiles leave the transaction for mapping (open-in-view is off), so their collections load here. */
    private static ArtistProfile loaded(ArtistProfile profile) {
        Hibernate.initialize(profile.getGenres());
        Hibernate.initialize(profile.getTags());
        Hibernate.initialize(profile.getLinks());
        Hibernate.initialize(profile.getPhotoMediaIds());
        return profile;
    }

    private void checkRequestedSlug(String slug) {
        // The format is checked by bean validation in the API.
        if (Slugs.isReserved(slug)) {
            throw new ArtistErrors.SlugReserved();
        }
    }

    private String claim(String slug, UUID profileId) {
        var existing = profiles.findBySlug(slug);
        if (existing.isPresent() && !existing.get().getId().equals(profileId)) {
            throw new ArtistErrors.SlugTaken();
        }
        return slug;
    }

    private String freeSlug(String stageName) {
        var base = Slugs.fromName(stageName, "artist");
        for (var attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
            var candidate = Slugs.candidate(base, attempt);
            if (!profiles.existsBySlug(candidate)) {
                return candidate;
            }
        }
        // Fifty artists with the same name: fall back to a random suffix.
        return Slugs.candidate(base, ThreadLocalRandom.current().nextInt(1000, 10000));
    }
}
