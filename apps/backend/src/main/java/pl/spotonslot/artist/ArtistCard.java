package pl.spotonslot.artist;

import java.util.Set;
import java.util.UUID;

/** A published artist as search lists it: no real name, no location (that lives in the location module). */
public record ArtistCard(UUID ownerId, String slug, String stageName, Set<Genre> genres, Long rateFrom, Long rateTo,
        int travelRadiusKm, UUID avatarMediaId) {
}
