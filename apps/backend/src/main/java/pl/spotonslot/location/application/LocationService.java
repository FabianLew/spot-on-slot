package pl.spotonslot.location.application;

import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import pl.spotonslot.location.GeoPoint;
import pl.spotonslot.location.SubjectType;
import pl.spotonslot.location.domain.Area;
import pl.spotonslot.location.domain.Location;
import pl.spotonslot.location.domain.LocationErrors;
import pl.spotonslot.location.domain.LocationSource;
import pl.spotonslot.location.domain.Place;
import pl.spotonslot.location.infrastructure.LocationRepository;

/**
 * Users' own locations. The point is approximated before anything else sees it, including the geocoder, and the
 * town name comes from reverse geocoding that point, so the stored label always matches the stored point.
 */
@Service
@RequiredArgsConstructor
public class LocationService {

    private final LocationRepository locations;
    private final Geocoder geocoder;
    private final TransactionTemplate transaction;

    public List<Place> search(String query, Locale locale) {
        return geocoder.search(query.strip(), locale);
    }

    /** The geocoder call runs before the transaction, so a slow provider never holds a database connection. */
    public Location setForUser(UUID userId, GeoPoint point, LocationSource source, Locale locale) {
        var approximate = point.approximate();
        var area = geocoder.reverse(approximate, locale).orElseThrow(LocationErrors.PlaceNotFound::new);
        try {
            return transaction.execute(status -> save(userId, approximate, area, source));
        } catch (DataIntegrityViolationException e) {
            // Two first saves for the same user raced on location_subject_uq.
            throw new LocationErrors.ConcurrentUpdate();
        }
    }

    @Transactional(readOnly = true)
    public Location getForUser(UUID userId) {
        return locations.findBySubjectTypeAndSubjectId(SubjectType.USER, userId)
                .orElseThrow(LocationErrors.NotSet::new);
    }

    /** Idempotent: deleting a location that is not set is not an error. */
    @Transactional
    public void deleteForUser(UUID userId) {
        locations.deleteBySubject(SubjectType.USER, userId);
    }

    private Location save(UUID userId, GeoPoint point, Area area, LocationSource source) {
        var location = locations.findBySubjectTypeAndSubjectId(SubjectType.USER, userId)
                .orElseGet(() -> Location.approximate(SubjectType.USER, userId));
        location.moveTo(point, area, source);
        return locations.saveAndFlush(location);
    }
}
