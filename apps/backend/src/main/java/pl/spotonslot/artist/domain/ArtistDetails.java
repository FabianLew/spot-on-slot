package pl.spotonslot.artist.domain;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** The editable part of a profile, already validated. Rates in grosze. */
public record ArtistDetails(
        String stageName,
        String firstName,
        String lastName,
        String bio,
        Set<Genre> genres,
        List<String> tags,
        Map<LinkKind, String> links,
        Long rateFrom,
        Long rateTo,
        int travelRadiusKm,
        Skills skills,
        UUID avatarMediaId,
        List<UUID> photoMediaIds) {
}
