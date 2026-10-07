package pl.spotonslot.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import jakarta.mail.Message;
import jakarta.mail.Multipart;
import jakarta.mail.Part;
import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import java.sql.Timestamp;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import pl.spotonslot.booking.application.BookingService;
import pl.spotonslot.support.IntegrationTest;

@IntegrationTest
class BookingNotificationIntegrationTest {

    private static final ZoneId WARSAW = ZoneId.of("Europe/Warsaw");
    private static final UUID ARTIST = UUID.fromString("0190a5d2-0000-7000-8000-0000000002f1");
    private static final UUID OWNER = UUID.fromString("0190a5d2-0000-7000-8000-0000000002e1");
    private static final UUID MANAGER = UUID.fromString("0190a5d2-0000-7000-8000-0000000002e2");
    private static final UUID RIVAL = UUID.fromString("0190a5d2-0000-7000-8000-0000000002e3");
    private static final UUID KLUB = UUID.fromString("0190a5d2-0000-7000-8000-0000000002a1");
    private static final UUID PIWNICA = UUID.fromString("0190a5d2-0000-7000-8000-0000000002a2");

    /** A Monday at least a week ahead, so every test date is in the future. */
    private static final LocalDate MONDAY = LocalDate.now(WARSAW).plusWeeks(1).with(
            TemporalAdjusters.next(DayOfWeek.MONDAY));

    @MockitoBean
    JavaMailSenderImpl mailSender;

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    BookingService bookingService;

    private String slug;

    @BeforeEach
    void seed() throws Exception {
        when(mailSender.createMimeMessage())
                .thenAnswer(invocation -> new MimeMessage(Session.getInstance(new Properties())));
        jdbc.update("DELETE FROM notification_preference");
        jdbc.update("DELETE FROM notification");
        jdbc.update("DELETE FROM booking");
        jdbc.update("DELETE FROM listing");
        jdbc.update("DELETE FROM availability_slot");
        jdbc.update("DELETE FROM availability_rule");
        jdbc.update("DELETE FROM artist_profile");
        jdbc.update("DELETE FROM venue");
        jdbc.update("DELETE FROM location");
        jdbc.update("DELETE FROM identity_user WHERE email LIKE '%@bookings.example.com'");

        account(ARTIST, "ARTIST", "pl");
        account(OWNER, "VENUE", "pl");
        account(MANAGER, "VENUE", "en");
        account(RIVAL, "VENUE", "pl");
        as(ARTIST, "ARTIST", put("/api/v1/artists/me").contentType(MediaType.APPLICATION_JSON)
                .content("{\"stageName\": \"DJ Alfa\"}"))
                .andExpect(status().isOk());
        jdbc.update("UPDATE artist_profile SET published_at = now() WHERE owner_id = ?", ARTIST);
        slug = jdbc.queryForObject("SELECT slug FROM artist_profile WHERE owner_id = ?", String.class, ARTIST);
        venue(KLUB, "klub", "Klub", OWNER, MANAGER);
        venue(PIWNICA, "piwnica", "Piwnica", RIVAL);
        slot(at(4, "21:00"), at(5, "04:00"));
    }

    @Test
    void eachStepTellsTheOtherSideInTheAppAndByEmail() throws Exception {
        var id = request(OWNER, KLUB, at(4, "22:00"), at(5, "02:00"), 150000);
        awaitNotifications(1);
        as(ARTIST, "ARTIST", get("/api/v1/notifications"))
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].type").value("BOOKING"))
                .andExpect(jsonPath("$.content[0].active").value(true))
                .andExpect(jsonPath("$.content[0].nearbyListing").doesNotExist())
                .andExpect(jsonPath("$.content[0].booking.bookingId").value(id))
                .andExpect(jsonPath("$.content[0].booking.kind").value("REQUESTED"))
                .andExpect(jsonPath("$.content[0].booking.by").value("VENUE"))
                .andExpect(jsonPath("$.content[0].booking.otherName").value("Klub"))
                .andExpect(jsonPath("$.content[0].booking.startsAt").value(at(4, "22:00").toString()))
                .andExpect(jsonPath("$.content[0].booking.amount").value(150000));
        // The person who acted is not told about their own step.
        as(OWNER, "VENUE", get("/api/v1/notifications")).andExpect(jsonPath("$.content").isEmpty());

        // The artist's counter goes to the whole venue team, each in their language.
        counter(id, at(4, "23:00"), at(5, "03:00"), 200000);
        awaitNotifications(3);
        as(MANAGER, "VENUE", get("/api/v1/notifications"))
                .andExpect(jsonPath("$.content[0].booking.kind").value("COUNTERED"))
                .andExpect(jsonPath("$.content[0].booking.by").value("ARTIST"))
                .andExpect(jsonPath("$.content[0].booking.otherName").value("DJ Alfa"))
                .andExpect(jsonPath("$.content[0].booking.amount").value(200000));

        var mails = captureMails(3);
        var request = mailTo(mails, ARTIST);
        assertThat(request.getSubject()).isEqualTo("Klub pyta o termin");
        var link = "http://localhost:3000/bookings/" + id;
        assertThat(part(request, "text/plain")).contains("Klub").containsPattern("1.?500 zł").contains(link);
        assertThat(part(request, "text/html")).contains("href=\"" + link + "\"").contains("Odpowiedz");
        assertThat(mailTo(mails, OWNER).getSubject()).isEqualTo("DJ Alfa proponuje nowe warunki");
        assertThat(mailTo(mails, MANAGER).getSubject()).isEqualTo("DJ Alfa proposes new terms");
        assertThat(part(mailTo(mails, MANAGER), "text/plain")).contains("2,000 zł");

        accept(MANAGER, id, 2);
        awaitNotifications(4);
        as(ARTIST, "ARTIST", get("/api/v1/notifications"))
                .andExpect(jsonPath("$.content[0].booking.kind").value("ACCEPTED"))
                .andExpect(jsonPath("$.content[0].booking.otherName").value("Klub"));
        // The manager's colleague is not told about the manager's step.
        assertThat(kinds(OWNER)).containsExactly("COUNTERED");

        as(ARTIST, "ARTIST", post("/api/v1/bookings/" + id + "/cancel").contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\": \"Choroba\"}"))
                .andExpect(status().isOk());
        awaitNotifications(6);
        assertThat(kinds(OWNER)).containsExactly("CANCELLED", "COUNTERED");
        assertThat(kinds(MANAGER)).containsExactly("CANCELLED", "COUNTERED");
        assertThat(subjects(captureMails(6))).contains("DJ Alfa odwołuje booking", "DJ Alfa cancels the booking");
    }

    @Test
    void declinedWithdrawnAndBookedElsewhere() throws Exception {
        var declined = request(OWNER, KLUB, at(4, "22:00"), at(5, "02:00"), 0);
        as(ARTIST, "ARTIST", post("/api/v1/bookings/" + declined + "/decline")
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\": \"Nie mogę\"}"))
                .andExpect(status().isOk());
        var withdrawn = request(OWNER, KLUB, at(4, "22:00"), at(5, "02:00"), 0);
        as(OWNER, "VENUE", post("/api/v1/bookings/" + withdrawn + "/withdraw")).andExpect(status().isOk());
        awaitNotifications(5);
        assertThat(kinds(ARTIST)).containsExactlyInAnyOrder("WITHDRAWN", "REQUESTED", "REQUESTED");
        assertThat(kinds(OWNER)).containsExactly("DECLINED");
        assertThat(kinds(MANAGER)).containsExactly("DECLINED");

        // Accepting one request turns the other one down: its venue hears that the time is taken.
        var rival = request(RIVAL, PIWNICA, at(4, "22:00"), at(5, "02:00"), 0);
        var chosen = request(OWNER, KLUB, at(4, "22:00"), at(5, "02:00"), 0);
        as(ARTIST, "ARTIST", post("/api/v1/bookings/" + chosen + "/accept").contentType(MediaType.APPLICATION_JSON)
                .content("{\"revision\": 1}"))
                .andExpect(status().isOk());
        awaitNotifications(10);
        as(RIVAL, "VENUE", get("/api/v1/notifications"))
                .andExpect(jsonPath("$.content[0].booking.bookingId").value(rival))
                .andExpect(jsonPath("$.content[0].booking.kind").value("DECLINED"))
                .andExpect(jsonPath("$.content[0].booking.by").value("SYSTEM"))
                .andExpect(jsonPath("$.content[0].booking.otherName").value("DJ Alfa"));
        assertThat(kinds(OWNER)).containsExactly("ACCEPTED", "DECLINED");
    }

    @Test
    void expiryTellsBothSides() throws Exception {
        var id = request(OWNER, KLUB, at(4, "22:00"), at(5, "02:00"), 0);
        awaitNotifications(1);
        jdbc.update("UPDATE booking SET respond_by = now() - interval '1 minute' WHERE id = ?::uuid", id);
        assertThat(bookingService.storeTimedOut()).isEqualTo(1);
        awaitNotifications(4);
        assertThat(kinds(ARTIST)).containsExactly("EXPIRED", "REQUESTED");
        assertThat(kinds(OWNER)).containsExactly("EXPIRED");
        assertThat(kinds(MANAGER)).containsExactly("EXPIRED");
        as(OWNER, "VENUE", get("/api/v1/notifications"))
                .andExpect(jsonPath("$.content[0].booking.by").value("SYSTEM"))
                .andExpect(jsonPath("$.content[0].booking.otherName").value("DJ Alfa"));
    }

    // ---- helpers

    private void awaitNotifications(int count) {
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> assertThat(
                jdbc.queryForObject("SELECT count(*) FROM notification WHERE recipient_id IN (?, ?, ?, ?)",
                        Integer.class, ARTIST, OWNER, MANAGER, RIVAL)).isEqualTo(count));
    }

    /** The booking kinds a person was told about, newest first. */
    private List<String> kinds(UUID user) {
        return jdbc.queryForList("SELECT payload ->> 'kind' FROM notification WHERE recipient_id = ?"
                + " ORDER BY created_at DESC, id DESC", String.class, user);
    }

    private List<MimeMessage> captureMails(int count) throws Exception {
        var captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, timeout(10_000).times(count)).send(captor.capture());
        for (var message : captor.getAllValues()) {
            message.saveChanges();
        }
        return captor.getAllValues();
    }

    private static MimeMessage mailTo(List<MimeMessage> messages, UUID user) {
        var found = messages.stream().filter(message -> to(message).equals(email(user))).toList();
        assertThat(found).hasSize(1);
        return found.getFirst();
    }

    private static List<String> subjects(List<MimeMessage> messages) {
        return messages.stream().map(message -> {
            try {
                return message.getSubject();
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }).collect(Collectors.toList());
    }

    private static String to(MimeMessage message) {
        try {
            return ((InternetAddress) message.getRecipients(Message.RecipientType.TO)[0]).getAddress();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static String email(UUID user) {
        return user.toString().substring(30) + "@bookings.example.com";
    }

    private void account(UUID id, String role, String locale) {
        var now = Timestamp.from(Instant.now());
        jdbc.update("DELETE FROM identity_user WHERE id = ?", id);
        jdbc.update("INSERT INTO identity_user (id, created_at, updated_at, version, email, password_hash, role,"
                + " status, locale, privacy_notice_accepted_at, email_verified_at) VALUES (?, ?, ?, 0, ?, 'x', ?,"
                + " 'ACTIVE', ?, ?, ?)", id, now, now, email(id), role, locale, now, now);
    }

    private void venue(UUID id, String slug, String name, UUID... team) {
        var now = Timestamp.from(Instant.now());
        jdbc.update("INSERT INTO venue (id, created_at, updated_at, version, slug, name, type, city, latitude,"
                + " longitude, published_at) VALUES (?, ?, ?, 0, ?, ?, 'CLUB', 'Kraków', 50.0617, 19.9372, ?)",
                id, now, now, slug, name, now);
        for (int i = 0; i < team.length; i++) {
            jdbc.update("INSERT INTO venue_member (id, created_at, updated_at, version, venue_id, user_id, role)"
                    + " VALUES (?, ?, ?, 0, ?, ?, ?)", UUID.randomUUID(), now, now, id, team[i],
                    i == 0 ? "OWNER" : "MANAGER");
        }
    }

    private void slot(Instant startsAt, Instant endsAt) throws Exception {
        as(ARTIST, "ARTIST", post("/api/v1/availability/me/slots").contentType(MediaType.APPLICATION_JSON)
                .content("{\"startsAt\": \"" + startsAt + "\", \"endsAt\": \"" + endsAt + "\"}"))
                .andExpect(status().isCreated());
    }

    private String request(UUID user, UUID venue, Instant startsAt, Instant endsAt, long amount) throws Exception {
        return id(as(user, "VENUE", post("/api/v1/bookings").contentType(MediaType.APPLICATION_JSON)
                .content("{\"venueId\": \"" + venue + "\", \"artistSlug\": \"" + slug + "\", \"startsAt\": \""
                        + startsAt + "\", \"endsAt\": \"" + endsAt + "\", \"amount\": " + amount + "}"))
                .andExpect(status().isCreated()));
    }

    private void counter(String id, Instant startsAt, Instant endsAt, long amount) throws Exception {
        as(ARTIST, "ARTIST", post("/api/v1/bookings/" + id + "/counter").contentType(MediaType.APPLICATION_JSON)
                .content("{\"startsAt\": \"" + startsAt + "\", \"endsAt\": \"" + endsAt + "\", \"amount\": "
                        + amount + "}"))
                .andExpect(status().isOk());
    }

    private void accept(UUID user, String id, int revision) throws Exception {
        as(user, "VENUE", post("/api/v1/bookings/" + id + "/accept").contentType(MediaType.APPLICATION_JSON)
                .content("{\"revision\": " + revision + "}"))
                .andExpect(status().isOk());
    }

    private static String id(ResultActions result) throws Exception {
        return JsonPath.read(result.andReturn().getResponse().getContentAsString(), "$.id");
    }

    private Instant at(int daysAfterMonday, String time) {
        return MONDAY.plusDays(daysAfterMonday).atTime(LocalTime.parse(time)).atZone(WARSAW).toInstant();
    }

    private ResultActions as(UUID user, String role, MockHttpServletRequestBuilder request) throws Exception {
        return mockMvc.perform(request.with(jwt().jwt(token -> token.subject(user.toString()))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role))));
    }

    private static String part(Part message, String mimeType) throws Exception {
        var found = new ArrayList<String>();
        collect(message, mimeType, found);
        return String.join("\n", found);
    }

    private static void collect(Part part, String mimeType, List<String> found) throws Exception {
        if (part.isMimeType(mimeType)) {
            found.add((String) part.getContent());
        } else if (part.getContent() instanceof Multipart multipart) {
            for (int i = 0; i < multipart.getCount(); i++) {
                collect(multipart.getBodyPart(i), mimeType, found);
            }
        }
    }
}
