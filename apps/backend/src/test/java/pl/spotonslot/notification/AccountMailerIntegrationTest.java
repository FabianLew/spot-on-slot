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
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionTemplate;
import pl.spotonslot.identity.AccountAlreadyExists;
import pl.spotonslot.identity.AccountDeleted;
import pl.spotonslot.identity.AccountDeletionRequested;
import pl.spotonslot.identity.EmailChangeRequested;
import pl.spotonslot.identity.PasswordChanged;
import pl.spotonslot.identity.EmailVerificationRequested;
import pl.spotonslot.identity.PasswordResetRequested;
import pl.spotonslot.support.IntegrationTest;
import pl.spotonslot.venue.VenueInvitationSent;
import pl.spotonslot.venue.VenueRole;

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
        assertThat(part(message, "text/html"))
                .contains("href=\"" + link + "\"")
                .contains("Potwierdź e-mail")
                .contains("Nowe konto")
                .contains("Przycisk nie działa?");
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

    @Test
    void sendsVenueInvitationWithVenueNameRoleAndWebLink() throws Exception {
        var message = publishAndCapture(new VenueInvitationSent(EMAIL, "pl", TOKEN, "Klub <Pod> Ziemią",
                VenueRole.MANAGER, Instant.parse("2026-10-13T08:00:00Z")));

        assertThat(message.getSubject()).isEqualTo("Zaproszenie do zespołu lokalu Klub <Pod> Ziemią w Spot On Slot");
        var link = "http://localhost:3000/venue-invitation?token=" + TOKEN;
        assertThat(part(message, "text/plain")).contains("jako menedżer").contains("7 dni").contains(link);
        assertThat(part(message, "text/html")).contains("Klub &lt;Pod&gt; Ziemią").contains("href=\"" + link + "\"");
    }

    @Test
    void sendsEnglishVenueInvitation() throws Exception {
        var message = publishAndCapture(new VenueInvitationSent(EMAIL, "en", TOKEN, "Basement", VenueRole.OWNER,
                Instant.parse("2026-10-13T08:00:00Z")));

        assertThat(message.getSubject()).isEqualTo("Invitation to the Basement team on Spot On Slot");
        assertThat(part(message, "text/plain")).contains("as owner").contains("valid for 7 days");
    }

    @Test
    void sendsPasswordChangedNotice() throws Exception {
        var message = publishAndCapture(new PasswordChanged(EMAIL, "pl"));

        assertThat(message.getSubject()).isEqualTo("Hasło do Spot On Slot zostało zmienione");
        assertThat(part(message, "text/plain"))
                .contains("Inne urządzenia zostały wylogowane")
                .contains("http://localhost:3000/forgot-password")
                .contains("no-reply@spotonslot.local");
    }

    @Test
    void sendsTheEmailChangeLinkToTheNewAddressAndANoticeToTheCurrentOne() throws Exception {
        var sent = publishAndCaptureAll(new EmailChangeRequested(EMAIL, "new@example.com", "pl", TOKEN, false), 2);

        var link = sent.stream().filter(message -> to(message).equals("new@example.com")).findFirst().orElseThrow();
        assertThat(link.getSubject()).isEqualTo("Potwierdź nowy adres e-mail w Spot On Slot");
        assertThat(part(link, "text/plain")).contains("http://localhost:3000/confirm-email-change?token=" + TOKEN)
                .contains("24 godziny");
        var notice = sent.stream().filter(message -> to(message).equals(EMAIL)).findFirst().orElseThrow();
        assertThat(notice.getSubject()).isEqualTo("Prośba o zmianę adresu e-mail w Spot On Slot");
        assertThat(part(notice, "text/plain")).contains("new@example.com").doesNotContain(TOKEN);
    }

    @Test
    void anAddressWithAnAccountGetsANoticeInsteadOfTheLink() throws Exception {
        var sent = publishAndCaptureAll(new EmailChangeRequested(EMAIL, "taken@example.com", "en", null, true), 2);

        var taken = sent.stream().filter(message -> to(message).equals("taken@example.com")).findFirst()
                .orElseThrow();
        assertThat(taken.getSubject()).isEqualTo("You already have a Spot On Slot account");
        assertThat(part(taken, "text/plain")).contains("http://localhost:3000/login").doesNotContain("token=");
    }

    @Test
    void sendsTheDeletionDateAndTheWayBack() throws Exception {
        var message = publishAndCapture(new AccountDeletionRequested(UUID.randomUUID(), EMAIL, "pl",
                Instant.parse("2026-10-21T10:00:00Z")));

        assertThat(message.getSubject()).isEqualTo("Twoje konto w Spot On Slot zostanie usunięte");
        assertThat(part(message, "text/plain")).contains("21 października 2026").contains("http://localhost:3000/login");
        assertThat(part(message, "text/html")).contains("Przywr&oacute;ć konto");
    }

    @Test
    void sendsTheLastEmailWithoutAButton() throws Exception {
        var message = publishAndCapture(new AccountDeleted(UUID.randomUUID(), EMAIL, "en"));

        assertThat(message.getSubject()).isEqualTo("Your Spot On Slot account was deleted");
        assertThat(part(message, "text/plain")).contains("dates and amounts").doesNotContain("http");
        assertThat(part(message, "text/html")).doesNotContain("&rarr;");
    }

    private List<MimeMessage> publishAndCaptureAll(Object event, int count) throws Exception {
        transactions.executeWithoutResult(status -> events.publishEvent(event));

        var captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, timeout(5_000).times(count)).send(captor.capture());
        for (var message : captor.getAllValues()) {
            message.saveChanges();
        }
        return captor.getAllValues();
    }

    private static String to(MimeMessage message) {
        try {
            return ((InternetAddress) message.getRecipients(Message.RecipientType.TO)[0]).getAddress();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
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
