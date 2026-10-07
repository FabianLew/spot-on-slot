package pl.spotonslot.notification.infrastructure;

import jakarta.mail.MessagingException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.mail.MailPreparationException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;
import pl.spotonslot.notification.NotificationProperties;

/**
 * Sends a multipart e-mail (plain text + HTML alternative) from {@code spotonslot.mail.from}.
 * Named explicitly: Boot already registers its {@code JavaMailSender} as {@code mailSender}.
 */
@Component("notificationMailSender")
@RequiredArgsConstructor
public class MailSender {

    private final JavaMailSender javaMailSender;
    private final NotificationProperties properties;

    public void send(String to, String subject, String text, String html) {
        send(to, subject, text, html, Map.of());
    }

    /** With extra headers, e.g. {@code List-Unsubscribe}. */
    public void send(String to, String subject, String text, String html, Map<String, String> headers) {
        var message = javaMailSender.createMimeMessage();
        try {
            for (var header : headers.entrySet()) {
                message.setHeader(header.getKey(), header.getValue());
            }
            var helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());
            helper.setFrom(properties.mail().from());
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(text, html);
        } catch (MessagingException e) {
            throw new MailPreparationException(e);
        }
        javaMailSender.send(message);
    }
}
