package pl.spotonslot.notification.application;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.MessageSource;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import pl.spotonslot.identity.AccountAlreadyExists;
import pl.spotonslot.identity.AccountDeleted;
import pl.spotonslot.identity.AccountDeletionRequested;
import pl.spotonslot.identity.EmailChangeRequested;
import pl.spotonslot.identity.EmailVerificationRequested;
import pl.spotonslot.identity.PasswordChanged;
import pl.spotonslot.identity.PasswordResetRequested;
import pl.spotonslot.notification.NotificationProperties;
import pl.spotonslot.notification.infrastructure.MailSender;

/**
 * Account e-mails (verification link, "you already have an account", password reset and change, address change,
 * deletion). They ignore notification settings. Each runs after the identity transaction commits; a failed send
 * leaves the event publication incomplete, so Modulith republishes it on restart.
 */
@Slf4j
@Component
@RequiredArgsConstructor
class AccountMailer {

    private static final ZoneId WARSAW = ZoneId.of("Europe/Warsaw");

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

    @ApplicationModuleListener
    void on(PasswordChanged event) {
        send("passwordChanged", event.email(), event.locale(), web("/forgot-password"), contact());
    }

    /** The link goes to the new address (or, if it has an account, a notice); the current address is told. */
    @ApplicationModuleListener
    void on(EmailChangeRequested event) {
        if (event.taken()) {
            send("emailTaken", event.newEmail(), event.locale(), web("/login"));
        } else {
            send("emailChange", event.newEmail(), event.locale(),
                    web("/confirm-email-change?token=" + event.token()));
        }
        send("emailChangeNotice", event.currentEmail(), event.locale(), web("/forgot-password"), event.newEmail(),
                contact());
    }

    @ApplicationModuleListener
    void on(AccountDeletionRequested event) {
        var locale = Locale.forLanguageTag(event.locale());
        send("deletionScheduled", event.email(), event.locale(), web("/login"), date(event.deletionAt(), locale),
                contact());
    }

    @ApplicationModuleListener
    void on(AccountDeleted event) {
        if (event.email() != null) {
            send("deleted", event.email(), event.locale(), null, contact());
        }
    }

    private String web(String path) {
        return properties.web().baseUrl() + path;
    }

    private String contact() {
        return properties.mail().contact();
    }

    private static String date(Instant at, Locale locale) {
        return DateTimeFormatter.ofPattern("d MMMM yyyy", locale).format(at.atZone(WARSAW));
    }

    /** {@code link} null = no button; {@code args} fill the body and footer texts. */
    private void send(String kind, String to, String localeTag, String link, Object... args) {
        var locale = Locale.forLanguageTag(localeTag == null ? "pl" : localeTag);
        var key = "mail.account." + kind + ".";
        mailSender.send(to, text(key + "subject", locale), plainText(key, locale, link, args),
                html(key, locale, link, args));
        log.info("Sent account e-mail '{}' (locale {})", kind, localeTag);
    }

    private String plainText(String key, Locale locale, String link, Object[] args) {
        var parts = new ArrayList<String>();
        parts.add(text("mail.account.greeting", locale));
        parts.add(text(key + "body", locale, args));
        if (link != null) {
            parts.add(link);
        }
        parts.add(text(key + "footer", locale, args));
        return String.join("\n\n", parts);
    }

    private String html(String key, Locale locale, String link, Object[] args) {
        var subject = text(key + "subject", locale);
        var body = text(key + "body", locale, args);
        var sections = MailLayout.intro(text(key + "kicker", locale), subject, text("mail.account.greeting", locale))
                + MailLayout.section(MailLayout.paragraph(body), link == null ? "16px 24px 28px" : "16px 24px 0");
        var footer = MailLayout.footnote(text(key + "footer", locale, args));
        if (link != null) {
            sections += MailLayout.button(link, text(key + "button", locale));
            footer = MailLayout.fallbackLink(text("mail.layout.fallback", locale), link) + footer;
        }
        return MailLayout.page(locale.getLanguage(), subject, body, sections, footer,
                text("mail.layout.tagline", locale));
    }

    private String text(String key, Locale locale, Object... args) {
        return messages.getMessage(key, args, locale);
    }
}
