package pl.spotonslot.notification.application;

import java.util.List;
import pl.spotonslot.artist.Genre;

/**
 * A user's settings for alerts about listings nearby, with the defaults their profile gives, and for e-mails
 * about unread messages.
 *
 * @param radiusKm {@code null} = {@code defaultRadiusKm}
 * @param genres empty = {@code defaultGenres}
 * @param messageEmail e-mails about messages left unread
 */
public record NotificationSettings(boolean enabled, boolean email, Integer radiusKm, List<Genre> genres,
        int defaultRadiusKm, List<Genre> defaultGenres, boolean messageEmail) {
}
