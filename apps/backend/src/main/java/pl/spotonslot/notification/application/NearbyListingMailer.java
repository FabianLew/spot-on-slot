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
        // Mail clients POST here for one-click unsubscribe (RFC 8058); the web app forwards it to the API.
        var oneClick = properties.web().baseUrl() + "/api/unsubscribe?token=" + token;
        var when = when(alert, locale);

        mailSender.send(account.email(),
                text("subject." + alert.kind(), locale, alert.authorName(), when),
                plainText(alert, when, locale, link, unsubscribe),
                html(alert, when, locale, link, unsubscribe),
                Map.of("List-Unsubscribe", "<" + oneClick + ">",
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
        var rows = new StringBuilder();
        var city = alert.city() == null ? "" : alert.city();
        rows.append(row(text("label.place", locale), escape(alert.venueName() == null
                ? text("placeValue.self", locale, city, alert.distanceKm())
                : text("placeValue.venue", locale, city, alert.distanceKm(), alert.venueName()))));
        if (!alert.genres().isEmpty()) {
            rows.append(row(text("label.genres", locale), alert.genres().stream()
                    .map(genre -> CHIP.formatted(escape(
                            messages.getMessage("mail.genre." + genre, null, genre.name(), locale))))
                    .collect(Collectors.joining(" "))));
        }
        var range = range(alert.priceFrom(), alert.priceTo(), locale);
        if (range != null) {
            rows.append(row(text("label.price." + alert.kind(), locale), escape(range)));
        }
        var free = Boolean.TRUE.equals(alert.free())
                ? FREE.formatted(escape(text("free", locale)))
                : "";
        var start = alert.startsAt().atZone(WARSAW);
        var end = alert.endsAt().atZone(WARSAW);
        var day = DateTimeFormatter.ofPattern("EEEE, d MMMM", locale).format(start);
        var hours = DateTimeFormatter.ofPattern("HH:mm", locale).format(start) + "–"
                + DateTimeFormatter.ofPattern("HH:mm", locale).format(end);
        var settings = properties.web().baseUrl() + "/settings#notifications";
        return LAYOUT.formatted(
                locale.getLanguage(),
                escape(text("title." + alert.kind(), locale, alert.authorName())),
                escape(intro(alert, locale)),
                escape(text("kicker." + alert.kind(), locale)),
                escape(text("title." + alert.kind(), locale, alert.authorName())),
                escape(intro(alert, locale)),
                escape(text("label.when", locale)),
                escape(day), escape(hours),
                rows,
                free,
                escape(link), escape(text("button", locale)),
                escape(text("reason." + alert.kind(), locale)),
                escape(settings), escape(text("settingsLink", locale)),
                escape(unsubscribe), escape(text("unsubscribe", locale)),
                escape(text("footer", locale)));
    }

    private static String row(String label, String valueHtml) {
        return ROW.formatted(escape(label), valueHtml);
    }

    private static String escape(String text) {
        return HtmlUtils.htmlEscape(text);
    }

    // The web app's arcade look in e-mail-safe HTML: tables and inline styles. Silkscreen and Space Mono load where
    // the client allows web fonts (Apple Mail, iOS); elsewhere the monospace fallback keeps the feel.
    private static final String PIXEL = "font-family:'Silkscreen','Courier New',Courier,monospace;";
    private static final String MONO = "font-family:'Space Mono','Courier New',Courier,monospace;";
    private static final String YELLOW = "#ffd400";
    private static final String RED = "#ff261f";

    private static final String CHIP = "<span style=\"display:inline-block;margin:0 4px 4px 0;padding:3px 8px;"
            + "border:1px solid #f2f2f2;color:#f2f2f2;font-size:12px;font-weight:bold;text-transform:uppercase;"
            + MONO + "\">%s</span>";

    private static final String FREE = "<tr><td colspan=\"2\" style=\"padding:14px 0 0;" + MONO
            + "font-size:14px;font-weight:bold;color:" + YELLOW + ";\">&#10003; %s</td></tr>";

    private static final String ROW = "<tr><td valign=\"top\" style=\"padding:10px 12px 10px 0;width:96px;" + PIXEL
            + "font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#a3a3a3;"
            + "border-top:1px dashed #3a3a3a;\">%s</td><td valign=\"top\" style=\"padding:10px 0;" + MONO
            + "font-size:15px;color:#f2f2f2;border-top:1px dashed #3a3a3a;\">%s</td></tr>";

    /** The pixel stripe under the logo: red and black squares, like the app's sidebar. */
    private static final String STRIPE = "<table role=\"presentation\" width=\"100%%\" cellpadding=\"0\" "
            + "cellspacing=\"0\" style=\"border-collapse:collapse;\"><tr>"
            + ("<td height=\"6\" style=\"height:6px;line-height:6px;font-size:0;background:" + RED
            + ";\">&nbsp;</td><td height=\"6\" style=\"height:6px;line-height:6px;font-size:0;background:#0a0a0a;\">"
            + "&nbsp;</td>").repeat(16)
            + "</tr></table>";

    private static final String LAYOUT = """
            <!DOCTYPE html>
            <html lang="%s">
            <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <meta name="color-scheme" content="dark">
            <meta name="supported-color-schemes" content="dark">
            <link href="https://fonts.googleapis.com/css2?family=Silkscreen&amp;family=Space+Mono:wght@400;700&amp;display=swap" rel="stylesheet">
            <title>%s</title>
            </head>
            <body style="margin:0;padding:0;background:#0a0a0a;">
            <div style="display:none;max-height:0;overflow:hidden;opacity:0;">%s</div>
            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
            <tr><td align="center" style="padding:28px 12px;">
            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;">
            <tr><td style="padding:0 0 16px;PIXEL_font-size:20px;line-height:20px;letter-spacing:2px;\
            color:YELLOW_;">SPOT<br>ON<br>SLOT</td></tr>
            <tr><td style="background:#141414;border:2px solid YELLOW_;">
            STRIPE_
            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:28px 24px 8px;">
            <span style="display:inline-block;padding:5px 10px;background:YELLOW_;color:#0a0a0a;PIXEL_\
            font-size:12px;letter-spacing:1px;text-transform:uppercase;">%s</span>
            <h1 style="margin:18px 0 8px;MONO_font-size:24px;line-height:30px;font-weight:bold;color:#ffffff;">%s</h1>
            <p style="margin:0;MONO_font-size:15px;line-height:22px;color:#c8c8c8;">%s</p>
            </td></tr>
            <tr><td style="padding:16px 24px 0;">
            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" \
            style="border:2px solid #f2f2f2;background:#0a0a0a;">
            <tr><td style="padding:14px 16px;">
            <div style="PIXEL_font-size:11px;letter-spacing:1px;text-transform:uppercase;color:YELLOW_;">%s</div>
            <div style="margin-top:6px;MONO_font-size:18px;line-height:24px;font-weight:bold;color:#ffffff;">%s</div>
            <div style="MONO_font-size:22px;line-height:30px;font-weight:bold;color:RED_;">%s</div>
            </td></tr>
            </table>
            </td></tr>
            <tr><td style="padding:12px 24px 0;">
            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0">%s%s</table>
            </td></tr>
            <tr><td style="padding:24px 24px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="background:RED_;border:2px solid #0a0a0a;box-shadow:4px 4px 0 YELLOW_;">
            <a href="%s" style="display:inline-block;padding:14px 22px;PIXEL_font-size:14px;letter-spacing:1px;\
            text-transform:uppercase;color:#0a0a0a;text-decoration:none;">%s &rarr;</a>
            </td></tr></table>
            </td></tr>
            </table>
            </td></tr>
            <tr><td style="padding:20px 4px 0;MONO_font-size:12px;line-height:18px;color:#8a8a8a;">
            <p style="margin:0 0 12px;">%s</p>
            <p style="margin:0 0 12px;"><a href="%s" style="color:#f2f2f2;">%s</a>
            &nbsp;&middot;&nbsp; <a href="%s" style="color:#f2f2f2;">%s</a></p>
            <p style="margin:0;PIXEL_font-size:11px;letter-spacing:1px;color:#5c5c5c;">%s</p>
            </td></tr>
            </table>
            </td></tr>
            </table>
            </body>
            </html>
            """.replace("PIXEL_", PIXEL).replace("MONO_", MONO).replace("YELLOW_", YELLOW).replace("RED_", RED)
            .replace("STRIPE_", STRIPE);

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
