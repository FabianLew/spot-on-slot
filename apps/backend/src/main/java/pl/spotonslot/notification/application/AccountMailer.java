package pl.spotonslot.notification.application;

import java.util.Locale;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.MessageSource;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;
import pl.spotonslot.identity.AccountAlreadyExists;
import pl.spotonslot.identity.EmailVerificationRequested;
import pl.spotonslot.identity.PasswordResetRequested;
import pl.spotonslot.notification.NotificationProperties;
import pl.spotonslot.notification.infrastructure.MailSender;

/**
 * Account e-mails (verification link, "you already have an account", password reset). Each runs after the identity
 * transaction commits; a failed send leaves the event publication incomplete, so Modulith republishes it on restart.
 */
@Slf4j
@Component
@RequiredArgsConstructor
class AccountMailer {

    private final MailSender mailSender;
    private final MessageSource messages;
    private final NotificationProperties properties;

    @ApplicationModuleListener
    void on(EmailVerificationRequested event) {
        send("verify", event.email(), event.locale(), web("/verify-email?token=" + event.token()));
    }

    @ApplicationModuleListener
    void on(AccountAlreadyExists event) {
        send("exists", event.email(), event.locale(), web("/login"));
    }

    @ApplicationModuleListener
    void on(PasswordResetRequested event) {
        send("reset", event.email(), event.locale(), web("/reset-password?token=" + event.token()));
    }

    private String web(String path) {
        return properties.web().baseUrl() + path;
    }

    private void send(String kind, String to, String localeTag, String link) {
        var locale = Locale.forLanguageTag(localeTag);
        var key = "mail.account." + kind + ".";
        mailSender.send(to, text(key + "subject", locale), plainText(key, locale, link), html(key, locale, link));
        log.info("Sent account e-mail '{}' (locale {})", kind, localeTag);
    }

    private String plainText(String key, Locale locale, String link) {
        return String.join("\n\n",
                text("mail.account.greeting", locale),
                text(key + "body", locale),
                link,
                text(key + "footer", locale));
    }

    private String html(String key, Locale locale, String link) {
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
                escaped("mail.account.greeting", locale),
                escaped(key + "body", locale),
                href, escaped(key + "button", locale),
                href, href,
                escaped(key + "footer", locale));
    }

    private String escaped(String key, Locale locale) {
        return HtmlUtils.htmlEscape(text(key, locale));
    }

    private String text(String key, Locale locale) {
        return messages.getMessage(key, null, locale);
    }
}
