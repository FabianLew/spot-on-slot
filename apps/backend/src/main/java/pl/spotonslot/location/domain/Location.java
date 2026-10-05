package pl.spotonslot.location.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import pl.spotonslot.location.GeoPoint;
import pl.spotonslot.location.SubjectType;
import pl.spotonslot.shared.persistence.BaseEntity;

/** Where a subject is. The PostGIS {@code point} column is derived from latitude and longitude by the database. */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "location")
public class Location extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(name = "subject_type", nullable = false, length = 16, updatable = false)
    private SubjectType subjectType;

    @Column(name = "subject_id", nullable = false, updatable = false)
    private UUID subjectId;

    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false, length = 16)
    private LocationSource source;

    @Enumerated(EnumType.STRING)
    @Column(name = "precision", nullable = false, length = 16)
    private LocationPrecision precision;

    @Column(name = "label", nullable = false, length = 200)
    private String label;

    @Column(name = "city", nullable = false, length = 120)
    private String city;

    @Column(name = "region", length = 120)
    private String region;

    @Column(name = "country_code", length = 2)
    private String countryCode;

    @Column(name = "latitude", nullable = false)
    private double latitude;

    @Column(name = "longitude", nullable = false)
    private double longitude;

    /** A person's location: only the approximated point is kept. */
    public static Location approximate(SubjectType subjectType, UUID subjectId) {
        var location = new Location();
        location.subjectType = subjectType;
        location.subjectId = subjectId;
        location.precision = LocationPrecision.APPROXIMATE;
        return location;
    }

    /** Moves the location; for an approximate location {@code point} must already be approximated. */
    public void moveTo(GeoPoint point, Area area, LocationSource source) {
        this.latitude = point.latitude();
        this.longitude = point.longitude();
        this.label = area.label();
        this.city = area.city();
        this.region = area.region();
        this.countryCode = area.countryCode();
        this.source = source;
    }

    public GeoPoint point() {
        return new GeoPoint(latitude, longitude);
    }
}
