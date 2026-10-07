package pl.spotonslot.notification.application;

import java.time.Clock;
import java.time.Duration;
import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pl.spotonslot.artist.ArtistProfiles;
import pl.spotonslot.artist.Genre;
import pl.spotonslot.listing.Listings;
import pl.spotonslot.notification.NotificationType;
import pl.spotonslot.notification.domain.NotificationErrors;
import pl.spotonslot.notification.domain.NotificationPreference;
import pl.spotonslot.notification.infrastructure.NotificationPreferenceRepository;
import pl.spotonslot.notification.infrastructure.NotificationRepository;
import pl.spotonslot.shared.security.SecretToken;
import pl.spotonslot.shared.persistence.UuidV7;
import pl.spotonslot.venue.Venues;

/** A user's notifications (the bell) and their settings. */
@Service
@RequiredArgsConstructor
public class NotificationService {

    /** Notifications are kept this long. */
    static final Duration RETENTION = Duration.ofDays(90);

    private final NotificationRepository notifications;
    private final NotificationPreferenceRepository preferences;
    private final NotificationPayloads payloads;
    private final Listings listings;
    private final ArtistProfiles artistProfiles;
    private final Venues venues;
    private final Clock clock;

    // ---- the bell

    /** Newest first. */
    @Transactional(readOnly = true)
    public Page<NotificationView> list(UUID userId, Pageable pageable) {
        var page = notifications.findOfRecipient(userId, pageable);
        var listingIds = page.getContent().stream().map(notification -> notification.getListingId())
                .filter(Objects::nonNull).toList();
        var active = listings.activeAmong(listingIds);
        return page.map(notification -> switch (notification.getType()) {
            case NEARBY_LISTING -> new NotificationView(notification, payloads.nearbyListing(notification), null,
                    active.contains(notification.getListingId()));
            case BOOKING -> new NotificationView(notification, null, payloads.booking(notification), true);
        });
    }

    @Transactional(readOnly = true)
    public long unreadCount(UUID userId) {
        return notifications.countByRecipientIdAndReadAtIsNull(userId);
    }

    @Transactional
    public void markRead(UUID userId, UUID notificationId) {
        notifications.findByIdAndRecipientId(notificationId, userId)
                .orElseThrow(NotificationErrors.NotificationNotFound::new)
                .markRead(clock.instant());
    }

    @Transactional
    public void markAllRead(UUID userId) {
        notifications.markAllRead(userId, clock.instant());
    }

    // ---- settings

    @Transactional(readOnly = true)
    public NotificationSettings settings(UUID userId) {
        return settings(userId, preferences.findByUserId(userId).orElse(null));
    }

    /** {@code messageEmail} null leaves that setting as it is. */
    @Transactional
    public NotificationSettings update(UUID userId, boolean enabled, boolean email, Integer radiusKm,
            Collection<Genre> genres, Boolean messageEmail) {
        var preference = stored(userId);
        preference.updateNearby(enabled, email, radiusKm, genres);
        if (messageEmail != null) {
            preference.updateMessages(messageEmail);
        }
        return settings(userId, preference);
    }

    /** Whether the user wants e-mails about unread messages (yes without settings). */
    @Transactional(readOnly = true)
    public boolean wantsMessageEmails(UUID userId) {
        return preferences.findByUserId(userId).map(NotificationPreference::isMessageEmail).orElse(true);
    }

    /** Switches e-mails about listings nearby off from the link in an e-mail; alerts in the app stay. */
    @Transactional
    public void unsubscribe(String token) {
        preferences.findByUnsubscribeToken(token)
                .orElseThrow(NotificationErrors.UnsubscribeInvalid::new)
                .unsubscribeNearbyEmail();
    }

    /** The user's settings row, stored with the defaults first if they have none. */
    @Transactional
    public NotificationPreference stored(UUID userId) {
        return preferences.findByUserId(userId).orElseGet(() -> {
            preferences.insertDefaults(UuidV7.generate(), userId, SecretToken.generate());
            return preferences.findByUserId(userId).orElseThrow();
        });
    }

    // ---- retention

    /** Deletes notifications older than 90 days; returns how many. */
    @Transactional
    public int deleteOld() {
        return notifications.deleteCreatedBefore(clock.instant().minus(RETENTION));
    }

    private NotificationSettings settings(UUID userId, NotificationPreference preference) {
        var defaultRadius = NearbyListingAlerts.VENUE_DEFAULT_RADIUS_KM;
        var defaultGenres = EnumSet.noneOf(Genre.class);
        var artist = artistProfiles.findPublishedCards(List.of(userId)).stream().findFirst();
        if (artist.isPresent()) {
            defaultRadius = Math.clamp(artist.get().travelRadiusKm(), NotificationPreference.MIN_RADIUS_KM,
                    NotificationPreference.MAX_RADIUS_KM);
            defaultGenres.addAll(artist.get().genres());
        } else {
            var venueIds = venues.findManagedBy(userId).stream().map(member -> member.venueId()).toList();
            venues.findPublishedCards(venueIds).forEach(venue -> defaultGenres.addAll(venue.genres()));
        }
        if (preference == null) {
            return new NotificationSettings(true, true, null, List.of(), defaultRadius, List.copyOf(defaultGenres),
                    true);
        }
        return new NotificationSettings(preference.isNearbyEnabled(), preference.isNearbyEmail(),
                preference.getNearbyRadiusKm(), preference.getNearbyGenres().stream().sorted().toList(),
                defaultRadius, List.copyOf(defaultGenres), preference.isMessageEmail());
    }
}
