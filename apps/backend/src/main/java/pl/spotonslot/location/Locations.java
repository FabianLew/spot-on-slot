package pl.spotonslot.location;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.spotonslot.location.application.Geocoder;
import pl.spotonslot.location.domain.Place;
import pl.spotonslot.location.infrastructure.LocationRepository;

/** The module's facade for other modules (profiles, search): where a user is, who is near a point, where an address is. */
@Service
@RequiredArgsConstructor
public class Locations {

    public static final double MIN_RADIUS_KM = 1;
    public static final double MAX_RADIUS_KM = 500;
    public static final int MAX_RESULTS = 1000;

    private final LocationRepository repository;
    private final Geocoder geocoder;

    /**
     * The best address or street match for {@code query} with its exact point; empty when the geocoder only knows
     * the town or nothing. Calls the geocoder, so keep it outside transactions.
     *
     * @throws pl.spotonslot.shared.error.ServiceUnavailableException when the geocoder does not answer
     */
    public Optional<GeocodedAddress> geocodeAddress(String query, Locale locale) {
        var places = geocoder.search(query.strip(), locale);
        return places.stream().filter(place -> place.kind() == Place.Kind.HOUSE).findFirst()
                .or(() -> places.stream().filter(place -> place.kind() == Place.Kind.STREET).findFirst())
                .map(place -> new GeocodedAddress(place.street(), place.postalCode(), place.city(), place.region(),
                        place.countryCode(), place.point()));
    }

    /** The town a user set as their location, if any. */
    @Transactional(readOnly = true)
    public Optional<LocationSummary> findForUser(UUID userId) {
        return repository.findBySubjectTypeAndSubjectId(SubjectType.USER, userId)
                .map(location -> new LocationSummary(location.getLabel(), location.getCity(), location.getRegion(),
                        location.getCountryCode()));
    }

    /** The stored (approximated, ~1 km) point of a user's location, if they set one. */
    @Transactional(readOnly = true)
    public Optional<GeoPoint> findPointForUser(UUID userId) {
        return repository.findBySubjectTypeAndSubjectId(SubjectType.USER, userId).map(location -> location.point());
    }

    /**
     * Subjects of {@code type} within {@code radiusKm} of {@code center}, nearest first. Distances are measured to
     * the stored (for people, approximated) points.
     *
     * @throws IllegalArgumentException for a radius outside 1–500 km or a limit outside 1–1000
     */
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
                .map(row -> new Nearby(row.getSubjectId(), new GeoPoint(row.getLatitude(), row.getLongitude()),
                        row.getCity(), row.getDistance()))
                .toList();
    }
}
