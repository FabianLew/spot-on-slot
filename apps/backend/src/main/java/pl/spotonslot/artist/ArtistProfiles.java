package pl.spotonslot.artist;

import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import pl.spotonslot.artist.application.ArtistProfileService;
import pl.spotonslot.artist.domain.ArtistProfile;

/** The module's facade for other modules. */
@Service
@RequiredArgsConstructor
public class ArtistProfiles {

    private final ArtistProfileService profiles;

    /** The user's profile if it is published; drafts are invisible to other modules. */
    public Optional<ArtistSummary> findPublishedByOwner(UUID ownerId) {
        return profiles.findPublishedByOwner(ownerId).map(ArtistProfiles::summary);
    }

    /** A published profile by its public address. */
    public Optional<ArtistSummary> findPublishedBySlug(String slug) {
        return profiles.findPublishedBySlug(slug).map(ArtistProfiles::summary);
    }

    /** Cards of those of the users whose profile is published, in no particular order. */
    public List<ArtistCard> findPublishedCards(Collection<UUID> ownerIds) {
        return profiles.findPublishedByOwners(ownerIds).stream()
                .map(profile -> new ArtistCard(profile.getOwnerId(), profile.getSlug(), profile.getStageName(),
                        profile.getGenres().isEmpty() ? EnumSet.noneOf(Genre.class) : EnumSet.copyOf(profile.getGenres()),
                        profile.getRateFrom(), profile.getRateTo(), profile.getTravelRadiusKm(),
                        profile.getAvatarMediaId()))
                .toList();
    }

    /** Whether the user has a profile at all, draft or published. */
    public boolean exists(UUID ownerId) {
        return profiles.hasProfile(ownerId);
    }

    /** Any profile by id, for moderation. */
    public Optional<ArtistModerationView> findForModeration(UUID profileId) {
        return profiles.find(profileId).map(ArtistProfiles::moderationView);
    }

    /** The user's profile, published or not, for moderation. */
    public Optional<ArtistModerationView> findForModerationByOwner(UUID ownerId) {
        return profiles.findByOwner(ownerId).map(ArtistProfiles::moderationView);
    }

    /** A published profile by its public address, as moderation sees it (what can be reported). */
    public Optional<ArtistModerationView> findPublishedForModeration(String slug) {
        return profiles.findPublishedBySlug(slug).map(ArtistProfiles::moderationView);
    }

    /** Owners whose stage name contains {@code query}, ignoring case. */
    public List<UUID> ownersNamed(String query) {
        return profiles.ownersNamed(query);
    }

    /** Unpublishes the profile and keeps the owner from publishing it; false when there is no such profile. */
    public boolean hideByModeration(UUID profileId, String reason) {
        return profiles.hideByModeration(profileId, reason);
    }

    /** Lets the owner publish the profile again; false when there is no such profile. */
    public boolean restoreByModeration(UUID profileId) {
        return profiles.restoreByModeration(profileId);
    }

    private static ArtistModerationView moderationView(ArtistProfile profile) {
        return new ArtistModerationView(profile.getId(), profile.getOwnerId(), profile.getSlug(),
                profile.getStageName(), profile.isPublished(), profile.getModerationHiddenAt(),
                profile.getModerationReason());
    }

    private static ArtistSummary summary(ArtistProfile profile) {
        return new ArtistSummary(profile.getOwnerId(), profile.getSlug(), profile.getStageName(),
                profile.getTravelRadiusKm());
    }
}
