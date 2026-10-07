package pl.spotonslot.notification.application;

import java.util.Locale;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.MessageSource;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
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
        var subject = text("subject", locale, args);
        return MailLayout.page(locale.getLanguage(), subject, text("body", locale, args),
                MailLayout.intro(text("kicker", locale), subject, text("greeting", locale))
                        + MailLayout.section(MailLayout.paragraph(text("body", locale, args)), "16px 24px 0")
                        + MailLayout.button(link, text("button", locale)),
                MailLayout.fallbackLink(messages.getMessage("mail.layout.fallback", null, locale), link)
                        + MailLayout.footnote(text("footer", locale)),
                messages.getMessage("mail.layout.tagline", null, locale));
    }

    private String text(String key, Locale locale, Object... args) {
        return messages.getMessage(KEY + key, args, locale);
    }
}
