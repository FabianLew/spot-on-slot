package pl.spotonslot.notification.domain;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import java.util.Collection;
import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.BatchSize;
import pl.spotonslot.artist.Genre;
import pl.spotonslot.shared.persistence.BaseEntity;
import pl.spotonslot.shared.security.SecretToken;

/** A user's notification settings; users without one get the defaults. */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "notification_preference")
public class NotificationPreference extends BaseEntity {

    public static final int MIN_RADIUS_KM = 5;
    public static final int MAX_RADIUS_KM = 200;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "nearby_enabled", nullable = false)
    private boolean nearbyEnabled;

    @Column(name = "nearby_email", nullable = false)
    private boolean nearbyEmail;

    /** {@code null} = the default radius. */
    @Column(name = "nearby_radius_km")
    private Integer nearbyRadiusKm;

    /** Empty = the genres of the profile or venues. */
    @BatchSize(size = 100)
    @ElementCollection
    @CollectionTable(name = "notification_preference_genre", joinColumns = @JoinColumn(name = "preference_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "genre", nullable = false, length = 32)
    private Set<Genre> nearbyGenres = EnumSet.noneOf(Genre.class);

    /** E-mails about messages left unread in a conversation. */
    @Column(name = "message_email", nullable = false)
    private boolean messageEmail;

    /** Only switches e-mails off, so it is stored as is and repeated in every e-mail. */
    @Column(name = "unsubscribe_token", nullable = false, updatable = false, length = 64)
    private String unsubscribeToken;

    public static NotificationPreference defaults(UUID userId) {
        var preference = new NotificationPreference();
        preference.userId = userId;
        preference.nearbyEnabled = true;
        preference.nearbyEmail = true;
        preference.messageEmail = true;
        preference.unsubscribeToken = SecretToken.generate();
        return preference;
    }

    public void updateNearby(boolean enabled, boolean email, Integer radiusKm, Collection<Genre> genres) {
        this.nearbyEnabled = enabled;
        this.nearbyEmail = email;
        this.nearbyRadiusKm = radiusKm;
        this.nearbyGenres.clear();
        this.nearbyGenres.addAll(genres);
    }

    public void updateMessages(boolean email) {
        this.messageEmail = email;
    }

    public void unsubscribeNearbyEmail() {
        this.nearbyEmail = false;
    }
}
