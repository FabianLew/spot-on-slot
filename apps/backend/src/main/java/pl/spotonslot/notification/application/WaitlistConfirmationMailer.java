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
import pl.spotonslot.waitlist.WaitlistConfirmationRequested;

/**
 * Sends the double opt-in e-mail for a waitlist sign-up. Runs after the sign-up commits; a failed send leaves the
 * event publication incomplete, so Modulith republishes it on restart.
 */
@Slf4j
@Component
@RequiredArgsConstructor
class WaitlistConfirmationMailer {

    private static final String KEY = "mail.waitlist.confirm.";

    private final MailSender mailSender;
    private final MessageSource messages;
    private final NotificationProperties properties;

    @ApplicationModuleListener
    void on(WaitlistConfirmationRequested event) {
        var locale = Locale.forLanguageTag(event.locale());
        var link = properties.landing().baseUrl() + "/" + event.locale() + "/waitlist/confirm?token=" + event.token();

        mailSender.send(event.email(), text("subject", locale), plainText(locale, link), html(locale, link));
        log.info("Sent waitlist confirmation e-mail (locale {})", event.locale());
    }

    private String plainText(Locale locale, String link) {
        return String.join("\n\n",
                text("greeting", locale),
                text("body", locale) + "\n" + text("validity", locale),
                link,
                text("ignore", locale));
    }

    private String html(Locale locale, String link) {
        var href = HtmlUtils.htmlEscape(link);
        return """
                <!DOCTYPE html>
                <html lang="%s">
                <body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#111;">
                <p>%s</p>
                <p>%s<br>%s</p>
                <p><a href="%s" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;\
                text-decoration:none;border-radius:6px;">%s</a></p>
                <p style="font-size:13px;color:#555;word-break:break-all;"><a href="%s">%s</a></p>
                <p style="font-size:13px;color:#555;">%s</p>
                </body>
                </html>
                """.formatted(
                locale.getLanguage(),
                escaped("greeting", locale),
                escaped("body", locale), escaped("validity", locale),
                href, escaped("button", locale),
                href, href,
                escaped("ignore", locale));
    }

    private String escaped(String key, Locale locale) {
        return HtmlUtils.htmlEscape(text(key, locale));
    }

    private String text(String key, Locale locale) {
        return messages.getMessage(KEY + key, null, locale);
    }
}
