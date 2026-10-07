package pl.spotonslot.notification.application;

import static pl.spotonslot.notification.application.MailLayout.MONO;
import static pl.spotonslot.notification.application.MailLayout.PIXEL;
import static pl.spotonslot.notification.application.MailLayout.RED;
import static pl.spotonslot.notification.application.MailLayout.YELLOW;
import static pl.spotonslot.notification.application.MailLayout.escape;

import java.text.NumberFormat;
import java.time.Clock;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.MessageSource;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import pl.spotonslot.identity.Accounts;
import pl.spotonslot.notification.NotificationCreated;
import pl.spotonslot.notification.NotificationProperties;
import pl.spotonslot.notification.NotificationType;
import pl.spotonslot.notification.domain.BookingUpdate;
import pl.spotonslot.notification.domain.BookingUpdate.Kind;
import pl.spotonslot.notification.infrastructure.MailSender;
import pl.spotonslot.notification.infrastructure.NotificationRepository;

/**
 * E-mails every booking notification: the other side is waiting or the plans changed, so there is no daily limit and
 * no setting, like account e-mails. A failed send leaves the event incomplete, so Modulith republishes it on restart.
 */
@Slf4j
@Component
@RequiredArgsConstructor
class BookingMailer {

    private static final ZoneId WARSAW = ZoneId.of("Europe/Warsaw");
    private static final String KEY = "mail.booking.";

    private final NotificationRepository notifications;
    private final NotificationPayloads payloads;
    private final Accounts accounts;
    private final MailSender mailSender;
    private final MessageSource messages;
    private final NotificationProperties properties;
    private final Clock clock;

    @ApplicationModuleListener
    void on(NotificationCreated event) {
        if (event.type() != NotificationType.BOOKING) {
            return;
        }
        var notification = notifications.findById(event.notificationId()).orElse(null);
        if (notification == null || notification.getEmailSentAt() != null) {
            return;
        }
        var account = accounts.find(event.recipientId()).orElse(null);
        if (account == null) {
            return;
        }
        var update = payloads.booking(notification);
        var locale = Locale.forLanguageTag(account.locale());
        var link = properties.web().baseUrl() + "/bookings/" + update.bookingId();
        var title = byStep("title", update, locale, update.otherName());

        mailSender.send(account.email(), title, plainText(update, title, locale, link),
                html(update, title, locale, link), Map.of());
        notification.markEmailed(clock.instant());
        log.info("Sent a booking e-mail (locale {})", account.locale());
    }

    private String plainText(BookingUpdate update, String title, Locale locale, String link) {
        return String.join("\n\n",
                text("greeting", locale),
                title + "\n" + byStep("intro", update, locale),
                String.join("\n", List.of(
                        text("label.when", locale) + ": " + day(update, locale) + ", " + hours(update, locale),
                        text("label.other." + update.side(), locale) + ": " + update.otherName(),
                        text("label.amount", locale) + ": " + amount(update, locale))),
                button(update, locale) + ": " + link,
                text("reason", locale));
    }

    private String html(BookingUpdate update, String title, Locale locale, String link) {
        var intro = byStep("intro", update, locale);
        var rows = ROW.formatted(escape(text("label.other." + update.side(), locale)), escape(update.otherName()))
                + ROW.formatted(escape(text("label.amount", locale)), escape(amount(update, locale)));
        return MailLayout.page(locale.getLanguage(), title, intro,
                MailLayout.intro(text("kicker", locale), title, intro)
                        + MailLayout.section(WHEN.formatted(escape(text("label.when", locale)),
                                escape(day(update, locale)), escape(hours(update, locale))), "16px 24px 0")
                        + MailLayout.section("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" "
                                + "cellspacing=\"0\">" + rows + "</table>", "12px 24px 0")
                        + MailLayout.button(link, button(update, locale)),
                MailLayout.footnote(text("reason", locale))
                        + MailLayout.fallbackLink(messages.getMessage("mail.layout.fallback", null, locale), link),
                messages.getMessage("mail.layout.tagline", null, locale));
    }

    /** The text for this step: {@code key.KIND.BY} where the side matters (who asked, the system), else {@code key.KIND}. */
    private String byStep(String key, BookingUpdate update, Locale locale, Object... args) {
        var specific = messages.getMessage(KEY + key + "." + update.kind() + "." + update.by(), args, null, locale);
        return specific != null ? specific : text(key + "." + update.kind(), locale, args);
    }

    private String button(BookingUpdate update, Locale locale) {
        var answer = update.kind() == Kind.REQUESTED || update.kind() == Kind.COUNTERED;
        return text(answer ? "button.answer" : "button.view", locale);
    }

    private String amount(BookingUpdate update, Locale locale) {
        return update.amount() == 0 ? text("unpaid", locale) : text("money", locale, money(update.amount(), locale));
    }

    private static String day(BookingUpdate update, Locale locale) {
        return DateTimeFormatter.ofPattern("EEEE, d MMMM", locale).format(update.startsAt().atZone(WARSAW));
    }

    private static String hours(BookingUpdate update, Locale locale) {
        var format = DateTimeFormatter.ofPattern("HH:mm", locale);
        return format.format(update.startsAt().atZone(WARSAW)) + "–" + format.format(update.endsAt().atZone(WARSAW));
    }

    private String text(String key, Locale locale, Object... args) {
        return messages.getMessage(KEY + key, args, locale);
    }

    /** Grosze as złoty without the currency, e.g. "1 500" or "99,50". */
    private static String money(long grosze, Locale locale) {
        var format = NumberFormat.getNumberInstance(locale);
        format.setMinimumFractionDigits(grosze % 100 == 0 ? 0 : 2);
        format.setMaximumFractionDigits(2);
        return format.format(grosze / 100.0);
    }

    /** The date in its own box: label, day, hours (as in the listing alert). */
    private static final String WHEN = "<table role=\"presentation\" width=\"100%%\" cellpadding=\"0\" "
            + "cellspacing=\"0\" style=\"border:2px solid #f2f2f2;background:#0a0a0a;\"><tr>"
            + "<td style=\"padding:14px 16px;\"><div style=\"" + PIXEL + "font-size:11px;"
            + "letter-spacing:1px;text-transform:uppercase;color:" + YELLOW + ";\">%s</div>"
            + "<div style=\"margin-top:6px;" + MONO + "font-size:18px;line-height:24px;font-weight:bold;"
            + "color:#ffffff;\">%s</div><div style=\"" + MONO + "font-size:22px;line-height:30px;"
            + "font-weight:bold;color:" + RED + ";\">%s</div></td></tr></table>";

    private static final String ROW = "<tr><td valign=\"top\" style=\"padding:10px 12px 10px 0;width:96px;"
            + PIXEL + "font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#a3a3a3;"
            + "border-top:1px dashed #3a3a3a;\">%s</td><td valign=\"top\" style=\"padding:10px 0;" + MONO
            + "font-size:15px;color:#f2f2f2;border-top:1px dashed #3a3a3a;\">%s</td></tr>";
}
