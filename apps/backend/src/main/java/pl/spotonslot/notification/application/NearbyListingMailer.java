package pl.spotonslot.notification.application;

import java.text.NumberFormat;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.MessageSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;
import pl.spotonslot.identity.Accounts;
import pl.spotonslot.listing.ListingKind;
import pl.spotonslot.listing.Listings;
import pl.spotonslot.notification.NotificationCreated;
import pl.spotonslot.notification.NotificationProperties;
import pl.spotonslot.notification.NotificationType;
import pl.spotonslot.notification.domain.NearbyListingAlert;
import pl.spotonslot.notification.infrastructure.MailSender;
import pl.spotonslot.notification.infrastructure.NotificationPreferenceRepository;
import pl.spotonslot.notification.infrastructure.NotificationRepository;

/**
 * E-mails an alert about a listing nearby, unless the person switched e-mails off, already got the day's limit, or
 * the listing ended meanwhile. A failed send leaves the event incomplete, so Modulith republishes it on restart.
 */
@Slf4j
@Component
@RequiredArgsConstructor
class NearbyListingMailer {

    /** Alert e-mails per person per day (Polish time); the rest stay in the app. */
    static final int MAX_PER_DAY = 5;
    private static final ZoneId WARSAW = ZoneId.of("Europe/Warsaw");
    private static final String KEY = "mail.nearby.";
    /** Keeps the per-person e-mail lock apart from other advisory locks on the same id. */
    private static final long LOCK_SALT = 0x4e4f5449L;

    private final NotificationRepository notifications;
    private final NotificationService notificationService;
    private final NotificationPreferenceRepository preferences;
    private final NotificationPayloads payloads;
    private final Listings listings;
    private final Accounts accounts;
    private final MailSender mailSender;
    private final MessageSource messages;
    private final NotificationProperties properties;
    private final JdbcTemplate jdbc;
    private final Clock clock;

    @ApplicationModuleListener
    void on(NotificationCreated event) {
        if (event.type() != NotificationType.NEARBY_LISTING) {
            return;
        }
        // One person's alerts one at a time, so the daily limit holds when several listings arrive together.
        lock(event.recipientId());
        var notification = notifications.findById(event.notificationId()).orElse(null);
        if (notification == null || notification.getEmailSentAt() != null) {
            return;
        }
        var setting = preferences.findByUserId(event.recipientId());
        if (setting.map(found -> !found.isNearbyEnabled() || !found.isNearbyEmail()).orElse(false)
                || listings.findActive(notification.getListingId()).isEmpty()) {
            return;
        }
        var now = clock.instant();
        var today = LocalDate.ofInstant(now, WARSAW).atStartOfDay(WARSAW).toInstant();
        if (notifications.countEmailedSince(event.recipientId(), NotificationType.NEARBY_LISTING, today)
                >= MAX_PER_DAY) {
            return;
        }
        var account = accounts.find(event.recipientId()).orElse(null);
        if (account == null) {
            return;
        }
        var token = notificationService.stored(event.recipientId()).getUnsubscribeToken();
        var alert = payloads.nearbyListing(notification);
        var locale = Locale.forLanguageTag(account.locale());
        var link = properties.web().baseUrl() + "/o/" + alert.listingId();
        var unsubscribe = properties.web().baseUrl() + "/unsubscribe?token=" + token;
        var when = when(alert, locale);

        mailSender.send(account.email(),
                text("subject." + alert.kind(), locale, alert.authorName(), when),
                plainText(alert, when, locale, link, unsubscribe),
                html(alert, when, locale, link, unsubscribe),
                Map.of("List-Unsubscribe", "<" + unsubscribe + ">",
                        "List-Unsubscribe-Post", "List-Unsubscribe=One-Click"));
        notification.markEmailed(now);
        log.info("Sent a listing alert e-mail (locale {})", account.locale());
    }

    /** The listing's details, one line each. */
    private List<String> details(NearbyListingAlert alert, String when, Locale locale) {
        var lines = new ArrayList<String>();
        lines.add(text("when", locale, when));
        var city = alert.city() == null ? "" : alert.city();
        lines.add(alert.venueName() == null
                ? text("place.self", locale, city, alert.distanceKm())
                : text("place.venue", locale, city, alert.distanceKm(), alert.venueName()));
        if (!alert.genres().isEmpty()) {
            lines.add(text("genres", locale, alert.genres().stream()
                    .map(genre -> messages.getMessage("mail.genre." + genre, null, genre.name(), locale))
                    .collect(Collectors.joining(", "))));
        }
        var range = range(alert.priceFrom(), alert.priceTo(), locale);
        if (range != null) {
            lines.add(text("price." + alert.kind(), locale, range));
        }
        if (Boolean.TRUE.equals(alert.free())) {
            lines.add(text("free", locale));
        }
        return lines;
    }

    private String plainText(NearbyListingAlert alert, String when, Locale locale, String link, String unsubscribe) {
        return String.join("\n\n",
                text("greeting", locale),
                intro(alert, locale),
                String.join("\n", details(alert, when, locale)),
                text("button", locale) + ": " + link,
                text("reason." + alert.kind(), locale) + " " + text("settings", locale),
                text("unsubscribe", locale) + ": " + unsubscribe);
    }

    private String html(NearbyListingAlert alert, String when, Locale locale, String link, String unsubscribe) {
        var href = HtmlUtils.htmlEscape(link);
        var details = details(alert, when, locale).stream().map(HtmlUtils::htmlEscape)
                .collect(Collectors.joining("<br>"));
        return """
                <!DOCTYPE html>
                <html lang="%s">
                <body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111;">
                <p>%s</p>
                <p>%s</p>
                <p>%s</p>
                <p><a href="%s" style="display:inline-block;padding:12px 20px;background:#d91f17;color:#fff;\
                text-decoration:none;">%s</a></p>
                <p style="font-size:13px;color:#555;">%s %s</p>
                <p style="font-size:13px;color:#555;"><a href="%s">%s</a></p>
                </body>
                </html>
                """.formatted(
                locale.getLanguage(),
                HtmlUtils.htmlEscape(text("greeting", locale)),
                HtmlUtils.htmlEscape(intro(alert, locale)),
                details,
                href, HtmlUtils.htmlEscape(text("button", locale)),
                HtmlUtils.htmlEscape(text("reason." + alert.kind(), locale)),
                HtmlUtils.htmlEscape(text("settings", locale)),
                HtmlUtils.htmlEscape(unsubscribe), HtmlUtils.htmlEscape(text("unsubscribe", locale)));
    }

    private String intro(NearbyListingAlert alert, Locale locale) {
        return alert.kind() == ListingKind.VENUE_SEEKING
                ? text("intro.VENUE_SEEKING", locale, alert.authorName())
                : text("intro.ARTIST_AVAILABLE", locale, alert.authorName(), alert.venueName());
    }

    /** E.g. "piątek, 16 października, 20:00–02:00" in Polish time. */
    private static String when(NearbyListingAlert alert, Locale locale) {
        var start = alert.startsAt().atZone(WARSAW);
        var end = alert.endsAt().atZone(WARSAW);
        return DateTimeFormatter.ofPattern("EEEE, d MMMM, HH:mm", locale).format(start) + "–"
                + DateTimeFormatter.ofPattern("HH:mm", locale).format(end);
    }

    /** Grosze as złoty, e.g. "do 1 500 zł"; {@code null} without amounts. */
    private String range(Long from, Long to, Locale locale) {
        if (from != null && to != null) {
            return text("range.between", locale, money(from, locale), money(to, locale));
        }
        if (from != null) {
            return text("range.from", locale, money(from, locale));
        }
        return to == null ? null : text("range.to", locale, money(to, locale));
    }

    private static String money(long grosze, Locale locale) {
        var format = NumberFormat.getNumberInstance(locale);
        format.setMinimumFractionDigits(grosze % 100 == 0 ? 0 : 2);
        format.setMaximumFractionDigits(2);
        return format.format(grosze / 100.0);
    }

    private String text(String key, Locale locale, Object... args) {
        return messages.getMessage(KEY + key, args, locale);
    }

    private void lock(UUID userId) {
        jdbc.queryForObject("SELECT 1 FROM pg_advisory_xact_lock(?)", Integer.class,
                userId.getMostSignificantBits() ^ userId.getLeastSignificantBits() ^ LOCK_SALT);
    }
}
