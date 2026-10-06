package pl.spotonslot.venue.domain;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import pl.spotonslot.artist.Genre;
import pl.spotonslot.venue.VenueType;

/** The editable part of a venue, already validated. {@code address} may be null. */
public record VenueDetails(
        String name,
        VenueType type,
        String description,
        Integer capacity,
        Address address,
        Set<Genre> genres,
        List<String> tags,
        Map<VenueLinkKind, String> links,
        UUID avatarMediaId,
        List<UUID> photoMediaIds) {

    public VenueDetails withAddress(Address address) {
        return new VenueDetails(name, type, description, capacity, address, genres, tags, links, avatarMediaId,
                photoMediaIds);
    }
}
