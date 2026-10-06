package pl.spotonslot.artist;

import java.util.UUID;

/** A published artist as other modules (search, booking) see it. */
public record ArtistSummary(UUID ownerId, String slug, String stageName, int travelRadiusKm) {
}
