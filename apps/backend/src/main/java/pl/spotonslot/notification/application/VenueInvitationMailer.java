package pl.spotonslot.notification.application;

import java.util.Locale;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.MessageSource;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;
import pl.spotonslot.notification.NotificationProperties;
import pl.spotonslot.notification.infrastructure.MailSender;
import pl.spotonslot.venue.VenueInvitationSent;

/**
 * Sends the invitation to a venue's team. Runs after the invitation commits; a failed send leaves the event
 * publication incomplete, so Modulith republishes it on restart.
 */
@Slf4j
@Component
@RequiredArgsConstructor
class VenueInvitationMailer {

    private static final String KEY = "mail.venue.invitation.";

    private final MailSender mailSender;
    private final MessageSource messages;
    private final NotificationProperties properties;

    @ApplicationModuleListener
    void on(VenueInvitationSent event) {
        var locale = Locale.forLanguageTag(event.locale());
        var link = properties.web().baseUrl() + "/venue-invitation?token=" + event.token();
        var role = text("role." + event.role().name(), locale);
        Object[] args = {event.venueName(), role};

        mailSender.send(event.email(), text("subject", locale, args), plainText(locale, link, args),
                html(locale, link, args));
        log.info("Sent venue invitation e-mail (locale {})", event.locale());
    }

    private String plainText(Locale locale, String link, Object[] args) {
        return String.join("\n\n",
                text("greeting", locale),
                text("body", locale, args),
                link,
                text("footer", locale));
    }

    private String html(Locale locale, String link, Object[] args) {
        var href = HtmlUtils.htmlEscape(link);
        return """
                <!DOCTYPE html>
                <html lang="%s">
                <body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111;">
                <p>%s</p>
                <p>%s</p>
                <p><a href="%s" style="display:inline-block;padding:12px 20px;background:#d91f17;color:#fff;\
                text-decoration:none;">%s</a></p>
                <p style="font-size:13px;color:#555;word-break:break-all;"><a href="%s">%s</a></p>
                <p style="font-size:13px;color:#555;">%s</p>
                </body>
                </html>
                """.formatted(
                locale.getLanguage(),
                HtmlUtils.htmlEscape(text("greeting", locale)),
                HtmlUtils.htmlEscape(text("body", locale, args)),
                href, HtmlUtils.htmlEscape(text("button", locale)),
                href, href,
                HtmlUtils.htmlEscape(text("footer", locale)));
    }

    private String text(String key, Locale locale, Object... args) {
        return messages.getMessage(KEY + key, args, locale);
    }
}
