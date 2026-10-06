package pl.spotonslot.venue;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import pl.spotonslot.venue.application.VenueService;

/** The module's facade for other modules. */
@Service
@RequiredArgsConstructor
public class Venues {

    private final VenueService venues;

    /** The venues a person is in the team of, with their role; drafts included. */
    public List<VenueMembership> findManagedBy(UUID userId) {
        return venues.membershipsOf(userId).stream()
                .map(member -> new VenueMembership(member.getVenueId(), member.getRole()))
                .toList();
    }

    /** A published venue; drafts are invisible to other modules. Published venues always have a point. */
    public Optional<VenueSummary> findPublished(UUID venueId) {
        return venues.findPublished(venueId).flatMap(venue -> venue.address().flatMap(address -> address.point()
                .map(point -> new VenueSummary(venue.getId(), venue.getSlug(), venue.getName(), address.city(),
                        point))));
    }
}
