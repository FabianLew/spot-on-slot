package pl.spotonslot.artist;

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

    /** Whether the user has a profile at all, draft or published. */
    public boolean exists(UUID ownerId) {
        return profiles.hasProfile(ownerId);
    }

    private static ArtistSummary summary(ArtistProfile profile) {
        return new ArtistSummary(profile.getOwnerId(), profile.getSlug(), profile.getStageName(),
                profile.getTravelRadiusKm());
    }
}
