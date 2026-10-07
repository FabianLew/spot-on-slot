package pl.spotonslot.notification.application;

import java.util.Locale;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.MessageSource;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
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
        var subject = text(key + "subject", locale);
        return MailLayout.page(locale.getLanguage(), subject, text(key + "body", locale),
                MailLayout.intro(text(key + "kicker", locale), subject, text("mail.account.greeting", locale))
                        + MailLayout.section(MailLayout.paragraph(text(key + "body", locale)), "16px 24px 0")
                        + MailLayout.button(link, text(key + "button", locale)),
                MailLayout.fallbackLink(text("mail.layout.fallback", locale), link)
                        + MailLayout.footnote(text(key + "footer", locale)),
                text("mail.layout.tagline", locale));
    }

    private String text(String key, Locale locale) {
        return messages.getMessage(key, null, locale);
    }
}
