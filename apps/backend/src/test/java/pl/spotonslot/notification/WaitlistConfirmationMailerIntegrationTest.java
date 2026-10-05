package pl.spotonslot.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
import org.springframework.boot.actuate.health.HealthContributorRegistry;
import org.springframework.boot.autoconfigure.mail.MailProperties;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import pl.spotonslot.support.IntegrationTest;
import pl.spotonslot.waitlist.WaitlistConfirmationRequested;

@IntegrationTest
class WaitlistConfirmationMailerIntegrationTest {

    private static final String EMAIL = "artist@example.com";
    private static final String TOKEN = "tOk3n-_abc";

    /** The concrete type keeps Boot's mail health contributor (conditional on {@code JavaMailSenderImpl}) happy. */
    @MockitoBean
    JavaMailSenderImpl mailSender;

    @Autowired
    ApplicationEventPublisher events;

    @Autowired
    TransactionTemplate transactions;

    @Autowired
    MockMvc mockMvc;

    @Autowired
    HealthContributorRegistry healthContributors;

    @Autowired
    MailProperties mailProperties;

    @BeforeEach
    void setUp() {
        when(mailSender.createMimeMessage()).thenAnswer(invocation -> new MimeMessage(Session.getInstance(new Properties())));
    }

    @Test
    void sendsPolishConfirmationEmail() throws Exception {
        var message = publishAndCapture(new WaitlistConfirmationRequested(EMAIL, "pl", TOKEN));

        assertThat(message.getRecipients(Message.RecipientType.TO))
                .containsExactly(new InternetAddress(EMAIL));
        assertThat(message.getFrom()).containsExactly(new InternetAddress("no-reply@spotonslot.local"));
        assertThat(message.getSubject()).isEqualTo("Potwierdź zapis na listę Spot On Slot");

        var link = "http://localhost:3001/pl/waitlist/confirm?token=" + TOKEN;
        assertThat(part(message, "text/plain"))
                .contains("Cześć!")
                .contains("Dziękujemy za zapis na listę oczekujących Spot On Slot.")
                .contains("Link jest ważny przez 48 godzin.")
                .contains(link)
                .contains("Jeśli to nie Ty, zignoruj tę wiadomość.");
        assertThat(part(message, "text/html"))
                .contains("href=\"" + link + "\"")
                .contains("Potwierdź zapis");
    }

    @Test
    void sendsEnglishConfirmationEmail() throws Exception {
        var message = publishAndCapture(new WaitlistConfirmationRequested(EMAIL, "en", TOKEN));

        assertThat(message.getSubject()).isEqualTo("Confirm your Spot On Slot waitlist sign-up");

        var link = "http://localhost:3001/en/waitlist/confirm?token=" + TOKEN;
        assertThat(part(message, "text/plain"))
                .contains("Hi!")
                .contains("The link is valid for 48 hours.")
                .contains(link)
                .contains("If this wasn't you, just ignore this email.");
        assertThat(part(message, "text/html"))
                .contains("href=\"" + link + "\"")
                .contains("Confirm sign-up")
                .contains("If this wasn&#39;t you");
    }

    /** Mail is non-critical (failed sends are retried by the event registry), so an SMTP outage must not fail health. */
    @Test
    void mailIsNotPartOfHealth() throws Exception {
        assertThat(healthContributors.getContributor("mail")).isNull();
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void smtpCallsTimeOut() {
        assertThat(mailProperties.getProperties())
                .containsEntry("mail.smtp.connectiontimeout", "10000")
                .containsEntry("mail.smtp.timeout", "10000")
                .containsEntry("mail.smtp.writetimeout", "10000");
    }

    private MimeMessage publishAndCapture(WaitlistConfirmationRequested event) throws Exception {
        transactions.executeWithoutResult(status -> events.publishEvent(event));

        var captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, timeout(5_000)).send(captor.capture());
        var message = captor.getValue();
        message.saveChanges(); // as JavaMailSenderImpl does before sending: sets each part's Content-Type
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
