package pl.spotonslot.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.mail.Message;
import jakarta.mail.Multipart;
import jakarta.mail.Part;
import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionTemplate;
import pl.spotonslot.identity.AccountAlreadyExists;
import pl.spotonslot.identity.EmailVerificationRequested;
import pl.spotonslot.identity.PasswordResetRequested;
import pl.spotonslot.support.IntegrationTest;

@IntegrationTest
class AccountMailerIntegrationTest {

    private static final String EMAIL = "artist@example.com";
    private static final String TOKEN = "tOk3n-_abc";

    @MockitoBean
    JavaMailSenderImpl mailSender;

    @Autowired
    ApplicationEventPublisher events;

    @Autowired
    TransactionTemplate transactions;

    @BeforeEach
    void setUp() {
        when(mailSender.createMimeMessage()).thenAnswer(invocation -> new MimeMessage(Session.getInstance(new Properties())));
    }

    @Test
    void sendsPolishVerificationEmailWithWebLink() throws Exception {
        var message = publishAndCapture(new EmailVerificationRequested(EMAIL, "pl", TOKEN));

        assertThat(message.getRecipients(Message.RecipientType.TO)).containsExactly(new InternetAddress(EMAIL));
        assertThat(message.getSubject()).isEqualTo("Potwierdź adres e-mail w Spot On Slot");
        var link = "http://localhost:3000/verify-email?token=" + TOKEN;
        assertThat(part(message, "text/plain")).contains("Cześć!").contains("48 godzin").contains(link);
        assertThat(part(message, "text/html")).contains("href=\"" + link + "\"").contains("Potwierdź e-mail");
    }

    @Test
    void sendsEnglishPasswordResetEmail() throws Exception {
        var message = publishAndCapture(new PasswordResetRequested(EMAIL, "en", TOKEN));

        assertThat(message.getSubject()).isEqualTo("Set a new Spot On Slot password");
        assertThat(part(message, "text/plain"))
                .contains("valid for 1 hour")
                .contains("http://localhost:3000/reset-password?token=" + TOKEN);
    }

    @Test
    void sendsAccountExistsEmailPointingToLogin() throws Exception {
        var message = publishAndCapture(new AccountAlreadyExists(EMAIL, "pl"));

        assertThat(message.getSubject()).isEqualTo("Masz już konto w Spot On Slot");
        assertThat(part(message, "text/plain")).contains("http://localhost:3000/login").contains("Nie pamiętam hasła");
    }

    private MimeMessage publishAndCapture(Object event) throws Exception {
        transactions.executeWithoutResult(status -> events.publishEvent(event));

        var captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, timeout(5_000)).send(captor.capture());
        var message = captor.getValue();
        message.saveChanges();
        return message;
    }

    private static String part(Part message, String mimeType) throws Exception {
        var parts = new ArrayList<String>();
        collect(message, mimeType, parts);
        assertThat(parts).as(mimeType + " parts").hasSize(1);
        return parts.getFirst();
    }

    private static void collect(Part part, String mimeType, List<String> found) throws Exception {
        var content = part.getContent();
        if (content instanceof Multipart multipart) {
            for (int i = 0; i < multipart.getCount(); i++) {
                collect(multipart.getBodyPart(i), mimeType, found);
            }
        } else if (part.isMimeType(mimeType)) {
            found.add((String) content);
        }
    }
}
