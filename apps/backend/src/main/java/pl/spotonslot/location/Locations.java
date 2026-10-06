package pl.spotonslot.location;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.spotonslot.location.infrastructure.LocationRepository;

/** The module's facade for other modules (profiles, search): where a user is and who is near a point. */
@Service
@RequiredArgsConstructor
public class Locations {

    public static final double MIN_RADIUS_KM = 1;
    public static final double MAX_RADIUS_KM = 500;
    public static final int MAX_RESULTS = 1000;

    private final LocationRepository repository;

    /**
     * Subjects of {@code type} within {@code radiusKm} of {@code center}, nearest first. Distances are measured to
     * the stored (for people, approximated) points.
     *
     * @throws IllegalArgumentException for a radius outside 1–500 km or a limit outside 1–1000
     */
    /** The town a user set as their location, if any. */
    @Transactional(readOnly = true)
    public Optional<LocationSummary> findForUser(UUID userId) {
        return repository.findBySubjectTypeAndSubjectId(SubjectType.USER, userId)
                .map(location -> new LocationSummary(location.getLabel(), location.getCity(), location.getRegion(),
                        location.getCountryCode()));
    }

    @Transactional(readOnly = true)
    public List<Nearby> findWithin(SubjectType type, GeoPoint center, double radiusKm, int limit) {
        if (!(radiusKm >= MIN_RADIUS_KM && radiusKm <= MAX_RADIUS_KM)) {
            throw new IllegalArgumentException("Radius must be between 1 and 500 km: " + radiusKm);
        }
        if (limit < 1 || limit > MAX_RESULTS) {
            throw new IllegalArgumentException("Limit must be between 1 and 1000: " + limit);
        }
        return repository.findWithin(type.name(), center.latitude(), center.longitude(), radiusKm * 1000, limit)
                .stream()
                .map(row -> new Nearby(row.getSubjectId(), row.getDistance()))
                .toList();
    }
}
