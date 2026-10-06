package pl.spotonslot.artist;

import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import pl.spotonslot.artist.application.ArtistProfileService;

/** The module's facade for other modules. */
@Service
@RequiredArgsConstructor
public class ArtistProfiles {

    private final ArtistProfileService profiles;

    /** The user's profile if it is published; drafts are invisible to other modules. */
    public Optional<ArtistSummary> findPublishedByOwner(UUID ownerId) {
        return profiles.findPublishedByOwner(ownerId).map(profile -> new ArtistSummary(profile.getOwnerId(),
                profile.getSlug(), profile.getStageName(), profile.getTravelRadiusKm()));
    }
}
