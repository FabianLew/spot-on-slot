package pl.spotonslot.notification.application;

import java.util.Locale;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.MessageSource;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;
import pl.spotonslot.identity.Accounts;
import pl.spotonslot.messaging.ConversationKind;
import pl.spotonslot.messaging.MessageUnread;
import pl.spotonslot.notification.NotificationProperties;
import pl.spotonslot.notification.infrastructure.MailSender;

/**
 * E-mails a reminder about a message left unread: who wrote and a link to the conversation, never the text. Off when
 * the person switched message e-mails off; there is no entry in the bell, since messages have their own counter.
 */
@Slf4j
@Component
@RequiredArgsConstructor
class MessageUnreadMailer {

    private static final String KEY = "mail.message.";

    private final NotificationService notifications;
    private final Accounts accounts;
    private final MailSender mailSender;
    private final MessageSource messages;
    private final NotificationProperties properties;

    @ApplicationModuleListener
    void on(MessageUnread event) {
        if (!notifications.wantsMessageEmails(event.recipientId())) {
            return;
        }
        var account = accounts.find(event.recipientId()).orElse(null);
        if (account == null) {
            return;
        }
        var locale = Locale.forLanguageTag(account.locale());
        var base = properties.web().baseUrl();
        var link = base + "/messages/" + event.conversationId();
        var settings = base + "/settings#notifications";
        var title = text("title", locale, event.senderName());
        var intro = text(event.kind() == ConversationKind.BOOKING ? "intro.BOOKING" : "intro.DIRECT", locale,
                event.senderName());

        var plain = String.join("\n\n", text("greeting", locale), title + "\n" + intro,
                text("button", locale) + ": " + link, text("reason", locale) + "\n" + settings);
        var html = MailLayout.page(locale.getLanguage(), title, intro,
                MailLayout.intro(text("kicker", locale), title, intro) + MailLayout.button(link, text("button", locale)),
                MailLayout.footnote(text("reason", locale))
                        + MailLayout.fallbackLink(text("settings", locale), settings)
                        + MailLayout.fallbackLink(messages.getMessage("mail.layout.fallback", null, locale), link),
                messages.getMessage("mail.layout.tagline", null, locale));
        mailSender.send(account.email(), title, plain, html);
        log.info("Sent an unread message e-mail (locale {})", account.locale());
    }

    private String text(String key, Locale locale, Object... args) {
        return messages.getMessage(KEY + key, args, locale);
    }
}
