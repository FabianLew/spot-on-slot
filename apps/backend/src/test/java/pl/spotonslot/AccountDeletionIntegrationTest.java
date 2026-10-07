package pl.spotonslot;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jayway.jsonpath.JsonPath;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import java.sql.Timestamp;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import pl.spotonslot.identity.EmailVerificationRequested;
import pl.spotonslot.identity.application.AccountPurgeService;
import pl.spotonslot.support.IntegrationTest;

/**
 * Deleting an account across modules: what the request hides, closes and cancels (the other side is told), and what
 * the purge after the grace period deletes or anonymizes.
 */
@IntegrationTest
@RecordApplicationEvents
class AccountDeletionIntegrationTest {

    private static final ZoneId WARSAW = ZoneId.of("Europe/Warsaw");
    private static final String PASSWORD = "correct horse battery";
    private static final UUID OWNER = UUID.fromString("0190a5d2-0000-7000-8000-0000000000d1");
    private static final UUID MANAGER = UUID.fromString("0190a5d2-0000-7000-8000-0000000000d2");
    private static final UUID OTHER_ARTIST = UUID.fromString("0190a5d2-0000-7000-8000-0000000000d3");
    private static final UUID VENUE = UUID.fromString("0190a5d2-0000-7000-8000-0000000000e1");
    private static final UUID SOLO_VENUE = UUID.fromString("0190a5d2-0000-7000-8000-0000000000e2");
    private static final UUID SHARED_VENUE = UUID.fromString("0190a5d2-0000-7000-8000-0000000000e3");
    private static final String DELETED = "Usunięte konto";
    private static final LocalDate MONDAY = LocalDate.now(WARSAW).plusWeeks(1).with(
            TemporalAdjusters.next(DayOfWeek.MONDAY));

    @MockitoBean
    JavaMailSenderImpl mailSender;

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    ApplicationEvents events;

    @Autowired
    AccountPurgeService purge;

    Instant started;

    @BeforeEach
    void setUp() {
        started = Instant.now();
        when(mailSender.createMimeMessage()).thenAnswer(invocation ->
                new MimeMessage(Session.getInstance(new Properties())));
        for (var table : List.of("notification", "conversation", "booking", "listing", "availability_slot",
                "availability_rule", "artist_profile", "location", "venue", "identity_refresh_token",
                "identity_token", "identity_user")) {
            jdbc.update("DELETE FROM " + table);
        }
    }

    @AfterEach
    void awaitListeners() {
        awaitQuiet();
    }

    @Test
    void anArtistsDeletionHidesAndCancelsThenThePurgeErasesButKeepsTheOtherSidesHistory() throws Exception {
        var token = signedIn("artist@example.com", "ARTIST");
        var artist = me(token);
        artistProfile(artist, "DJ Znikający", token);
        venue(VENUE, "pod-ziemia", "Pod Ziemią", true);
        member(VENUE, OWNER, "OWNER");
        var accepted = slot(token, 4);
        var countered = slot(token, 5);
        slot(token, 6);

        var bookingAccepted = request(VENUE, at(4, "22:00"), at(5, "02:00"));
        bearer(token, post("/api/v1/bookings/" + bookingAccepted + "/accept")
                .contentType(MediaType.APPLICATION_JSON).content("{\"revision\": 1}"))
                .andExpect(status().isOk());
        var bookingCountered = request(VENUE, at(5, "22:00"), at(6, "02:00"));
        bearer(token, post("/api/v1/bookings/" + bookingCountered + "/counter")
                .contentType(MediaType.APPLICATION_JSON).content("{\"startsAt\": \"" + at(5, "23:00")
                        + "\", \"endsAt\": \"" + at(6, "03:00") + "\", \"amount\": 50000,"
                        + " \"message\": \"Wolę później\"}"))
                .andExpect(status().isOk());
        var bookingWaiting = request(VENUE, at(6, "22:00"), at(7, "02:00"));
        var listing = id(bearer(token, post("/api/v1/listings/mine").contentType(MediaType.APPLICATION_JSON)
                .content("{\"startsAt\": \"" + at(6, "22:00") + "\", \"endsAt\": \"" + at(7, "02:00")
                        + "\", \"genres\": [\"TECHNO\"]}"))
                .andExpect(status().isCreated()));
        var conversation = id(bearer(token, post("/api/v1/conversations").contentType(MediaType.APPLICATION_JSON)
                .content("{\"venueSlug\": \"pod-ziemia\", \"body\": \"Cześć, gram techno\"}"))
                .andExpect(status().isCreated()));
        awaitQuiet();
        var artistNotifications = count("SELECT count(*) FROM notification WHERE recipient_id = ?", artist);

        requestDeletion(token).andExpect(status().isAccepted());

        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
            assertThat(statusOf("booking", bookingAccepted)).isEqualTo("CANCELLED");
            assertThat(statusOf("booking", bookingCountered)).isEqualTo("WITHDRAWN");
            assertThat(statusOf("booking", bookingWaiting)).isEqualTo("DECLINED");
            assertThat(statusOf("listing", listing)).isEqualTo("CLOSED");
            assertThat(count("SELECT count(*) FROM artist_profile WHERE owner_id = ? AND published_at IS NULL",
                    artist)).isOne();
        });
        awaitQuiet();
        // The cancelled time is free in the calendar again; the venue was told about every step, the artist not.
        assertThat(jdbc.queryForObject("SELECT status FROM availability_slot WHERE id = ?::uuid", String.class,
                accepted)).isEqualTo("FREE");
        assertThat(jdbc.queryForObject("SELECT message FROM booking_step WHERE booking_id = ?::uuid"
                + " AND type = 'CANCELLED'", String.class, bookingAccepted)).isEqualTo("Konto zostało usunięte");
        assertThat(jdbc.queryForList("SELECT payload ->> 'kind' FROM notification WHERE recipient_id = ?",
                String.class, OWNER)).contains("CANCELLED", "WITHDRAWN", "DECLINED");
        assertThat(count("SELECT count(*) FROM notification WHERE recipient_id = ?", artist))
                .isEqualTo(artistNotifications);

        assertThat(purge.purgeDue(Instant.now().plus(Duration.ofDays(15)))).isOne();

        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
            assertThat(count("SELECT count(*) FROM artist_profile WHERE owner_id = ?", artist)).isZero();
            assertThat(count("SELECT count(*) FROM location WHERE subject_id = ?", artist)).isZero();
            assertThat(count("SELECT count(*) FROM availability_slot WHERE owner_id = ?", artist)).isZero();
            assertThat(count("SELECT count(*) FROM listing WHERE artist_id = ?", artist)).isZero();
            assertThat(count("SELECT count(*) FROM notification WHERE recipient_id = ?", artist)).isZero();
            assertThat(count("SELECT count(*) FROM booking WHERE artist_id = ? AND artist_stage_name = ?", artist,
                    DELETED)).isEqualTo(3);
            assertThat(jdbc.queryForObject("SELECT artist_name FROM conversation WHERE id = ?::uuid", String.class,
                    conversation)).isEqualTo(DELETED);
        });
        awaitQuiet();
        assertThat(count("SELECT count(*) FROM identity_user WHERE id = ?", artist)).isZero();
        assertThat(count("SELECT count(*) FROM availability_slot WHERE id = ?::uuid", countered)).isZero();

        // The venue keeps its history: dates, amounts and statuses, without the artist's name or words.
        as(OWNER, "VENUE", get("/api/v1/bookings/" + bookingCountered))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.artist.stageName").value(DELETED))
                .andExpect(jsonPath("$.status").value("WITHDRAWN"))
                .andExpect(jsonPath("$.amount").value(50000))
                .andExpect(jsonPath("$.steps[1].type").value("COUNTERED"))
                .andExpect(jsonPath("$.steps[1].message").doesNotExist())
                .andExpect(jsonPath("$.steps[1].messageDeleted").value(true))
                .andExpect(jsonPath("$.steps[0].messageDeleted").value(false));
        as(OWNER, "VENUE", get("/api/v1/bookings/" + bookingAccepted))
                .andExpect(jsonPath("$.steps[2].message").value("Konto zostało usunięte"));
        as(OWNER, "VENUE", get("/api/v1/conversations/" + conversation + "/messages"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.messages[0].deleted").value(true))
                .andExpect(jsonPath("$.messages[0].body").value(""));
    }

    @Test
    void aVenueOwnerHandsOverSharedVenuesFirstAndTheirOwnVenuesGoWithTheAccount() throws Exception {
        var token = signedIn("venue@example.com", "VENUE");
        var user = me(token);
        venue(SOLO_VENUE, "solo", "Solo", true);
        venue(SHARED_VENUE, "wspolny", "Wspólny", true);
        member(SOLO_VENUE, user, "OWNER");
        member(SHARED_VENUE, user, "OWNER");
        member(SHARED_VENUE, MANAGER, "MANAGER");
        var slug = artistProfile(OTHER_ARTIST, "DJ Inny", null);
        as(OTHER_ARTIST, "ARTIST", post("/api/v1/availability/me/slots").contentType(MediaType.APPLICATION_JSON)
                .content("{\"startsAt\": \"" + at(4, "20:00") + "\", \"endsAt\": \"" + at(5, "04:00") + "\"}"))
                .andExpect(status().isCreated());
        var soloBooking = id(bearer(token, post("/api/v1/bookings").contentType(MediaType.APPLICATION_JSON)
                .content(bookingBody(SOLO_VENUE, slug, at(4, "21:00"), at(5, "01:00"))))
                .andExpect(status().isCreated()));
        var sharedBooking = id(as(MANAGER, "VENUE", post("/api/v1/bookings").contentType(MediaType.APPLICATION_JSON)
                .content(bookingBody(SHARED_VENUE, slug, at(4, "22:00"), at(5, "02:00"))))
                .andExpect(status().isCreated()));
        var soloListing = id(bearer(token, post("/api/v1/venues/" + SOLO_VENUE + "/listings")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"startsAt\": \"" + at(8, "20:00") + "\", \"endsAt\": \"" + at(9, "02:00")
                        + "\", \"genres\": [\"TECHNO\"]}"))
                .andExpect(status().isCreated()));

        // The last owner of a team with other people cannot leave it by deleting the account.
        bearer(token, get("/api/v1/me/deletion"))
                .andExpect(jsonPath("$.blockers.length()").value(1))
                .andExpect(jsonPath("$.blockers[0].kind").value("LAST_VENUE_OWNER"))
                .andExpect(jsonPath("$.blockers[0].id").value(SHARED_VENUE.toString()))
                .andExpect(jsonPath("$.blockers[0].name").value("Wspólny"));
        requestDeletion(token)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ACCOUNT_LAST_VENUE_OWNER"))
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.containsString("Wspólny")));

        jdbc.update("UPDATE venue_member SET role = 'OWNER' WHERE user_id = ?", MANAGER);
        awaitQuiet();
        requestDeletion(token).andExpect(status().isAccepted());

        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
            assertThat(statusOf("booking", soloBooking)).isEqualTo("WITHDRAWN");
            assertThat(statusOf("listing", soloListing)).isEqualTo("CLOSED");
            assertThat(count("SELECT count(*) FROM venue WHERE id = ? AND published_at IS NULL", SOLO_VENUE))
                    .isOne();
        });
        // The shared venue and its booking carry on.
        assertThat(count("SELECT count(*) FROM venue WHERE id = ? AND published_at IS NOT NULL", SHARED_VENUE))
                .isOne();
        assertThat(statusOf("booking", sharedBooking)).isEqualTo("PENDING");
        awaitQuiet();

        // Nobody tells an account waiting for deletion anything: the decline reaches only the other team member.
        as(OTHER_ARTIST, "ARTIST", post("/api/v1/bookings/" + sharedBooking + "/decline")
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isOk());
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> assertThat(count(
                "SELECT count(*) FROM notification WHERE recipient_id = ? AND payload ->> 'kind' = 'DECLINED'",
                MANAGER)).isOne());
        awaitQuiet();
        assertThat(count("SELECT count(*) FROM notification WHERE recipient_id = ?", user)).isZero();
        assertThat(jdbc.queryForList("SELECT payload ->> 'kind' FROM notification WHERE recipient_id = ?",
                String.class, OTHER_ARTIST)).contains("WITHDRAWN");

        assertThat(purge.purgeDue(Instant.now().plus(Duration.ofDays(15)))).isOne();

        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
            assertThat(count("SELECT count(*) FROM venue WHERE id = ?", SOLO_VENUE)).isZero();
            assertThat(count("SELECT count(*) FROM listing WHERE venue_id = ?", SOLO_VENUE)).isZero();
            assertThat(jdbc.queryForObject("SELECT venue_name FROM booking WHERE id = ?::uuid", String.class,
                    soloBooking)).isEqualTo(DELETED);
        });
        awaitQuiet();
        assertThat(count("SELECT count(*) FROM venue_member WHERE user_id = ?", user)).isZero();
        assertThat(jdbc.queryForObject("SELECT venue_name FROM booking WHERE id = ?::uuid", String.class,
                sharedBooking)).isEqualTo("Wspólny");
        assertThat(jdbc.queryForObject("SELECT role FROM venue_member WHERE venue_id = ? AND user_id = ?",
                String.class, SHARED_VENUE, MANAGER)).isEqualTo("OWNER");
    }

    @Test
    void aTeamLeftWithoutAnOwnerByThePurgeGetsItsLongestMemberAsOwner() throws Exception {
        var token = signedIn("venue@example.com", "VENUE");
        var user = me(token);
        venue(SHARED_VENUE, "wspolny", "Wspólny", true);
        member(SHARED_VENUE, user, "OWNER");
        requestDeletion(token).andExpect(status().isAccepted());
        // Someone joined during the grace period.
        member(SHARED_VENUE, MANAGER, "MANAGER");
        awaitQuiet();

        purge.purgeDue(Instant.now().plus(Duration.ofDays(15)));

        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> assertThat(jdbc.queryForObject(
                "SELECT role FROM venue_member WHERE venue_id = ? AND user_id = ?", String.class, SHARED_VENUE,
                MANAGER)).isEqualTo("OWNER"));
        assertThat(count("SELECT count(*) FROM venue_member WHERE user_id = ?", user)).isZero();
    }

    // ---- helpers

    private String signedIn(String email, String role) throws Exception {
        postJson("/api/v1/auth/register", Map.of("email", email, "password", PASSWORD, "role", role, "locale", "pl",
                "privacyNoticeAccepted", true, "acceptTerms", true)).andExpect(status().isAccepted());
        var token = events.stream(EmailVerificationRequested.class).filter(event -> event.email().equals(email))
                .reduce((first, second) -> second).orElseThrow().token();
        postJson("/api/v1/auth/verify-email", Map.of("token", token)).andExpect(status().isNoContent());
        var login = postJson("/api/v1/auth/login", Map.of("email", email, "password", PASSWORD))
                .andExpect(status().isOk()).andReturn();
        return JsonPath.read(login.getResponse().getContentAsString(), "$.accessToken");
    }

    private UUID me(String token) throws Exception {
        return UUID.fromString(JsonPath.read(bearer(token, get("/api/v1/me")).andReturn().getResponse()
                .getContentAsString(), "$.id"));
    }

    /** A published profile with a location; {@code token} null = saved through a test token. Returns the slug. */
    private String artistProfile(UUID artist, String stageName, String token) throws Exception {
        var save = put("/api/v1/artists/me").contentType(MediaType.APPLICATION_JSON)
                .content("{\"stageName\": \"" + stageName + "\", \"genres\": [\"TECHNO\"]}");
        (token == null ? as(artist, "ARTIST", save) : bearer(token, save)).andExpect(status().isOk());
        var now = Timestamp.from(Instant.now());
        jdbc.update("INSERT INTO location (id, created_at, updated_at, version, subject_type, subject_id, source,"
                + " precision, label, city, latitude, longitude) VALUES (?, ?, ?, 0, 'USER', ?, 'MANUAL',"
                + " 'APPROXIMATE', 'Kraków', 'Kraków', 50.06, 19.94)", UUID.randomUUID(), now, now, artist);
        jdbc.update("UPDATE artist_profile SET published_at = now() WHERE owner_id = ?", artist);
        return jdbc.queryForObject("SELECT slug FROM artist_profile WHERE owner_id = ?", String.class, artist);
    }

    private void venue(UUID id, String slug, String name, boolean published) {
        var now = Timestamp.from(Instant.now());
        jdbc.update("INSERT INTO venue (id, created_at, updated_at, version, slug, name, type, city, latitude,"
                + " longitude, published_at) VALUES (?, ?, ?, 0, ?, ?, 'CLUB', 'Kraków', 50.0617, 19.9372, ?)",
                id, now, now, slug, name, published ? now : null);
    }

    private void member(UUID venue, UUID user, String role) {
        var now = Timestamp.from(Instant.now());
        jdbc.update("INSERT INTO venue_member (id, created_at, updated_at, version, venue_id, user_id, role)"
                + " VALUES (?, ?, ?, 0, ?, ?, ?)", UUID.randomUUID(), now, now, venue, user, role);
    }

    /** A free evening on day {@code day} after next Monday, 20:00 to 04:00. */
    private String slot(String token, int day) throws Exception {
        return id(bearer(token, post("/api/v1/availability/me/slots").contentType(MediaType.APPLICATION_JSON)
                .content("{\"startsAt\": \"" + at(day, "20:00") + "\", \"endsAt\": \"" + at(day + 1, "04:00")
                        + "\"}"))
                .andExpect(status().isCreated()));
    }

    private String request(UUID venue, Instant startsAt, Instant endsAt) throws Exception {
        var slug = jdbc.queryForObject("SELECT slug FROM artist_profile LIMIT 1", String.class);
        return id(as(OWNER, "VENUE", post("/api/v1/bookings").contentType(MediaType.APPLICATION_JSON)
                .content(bookingBody(venue, slug, startsAt, endsAt)))
                .andExpect(status().isCreated()));
    }

    private static String bookingBody(UUID venue, String artistSlug, Instant startsAt, Instant endsAt) {
        return "{\"venueId\": \"" + venue + "\", \"artistSlug\": \"" + artistSlug + "\", \"startsAt\": \""
                + startsAt + "\", \"endsAt\": \"" + endsAt + "\", \"amount\": 100000}";
    }

    private ResultActions requestDeletion(String token) throws Exception {
        return bearer(token, post("/api/v1/me/deletion").contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\": \"" + PASSWORD + "\", \"confirm\": true}"));
    }

    private String statusOf(String table, String id) {
        return jdbc.queryForObject("SELECT status FROM " + table + " WHERE id = ?::uuid", String.class, id);
    }

    private int count(String sql, Object... args) {
        return jdbc.queryForObject(sql, Integer.class, args);
    }

    private void awaitQuiet() {
        await().atMost(Duration.ofSeconds(15)).until(() -> jdbc.queryForObject(
                "SELECT count(*) FROM event_publication WHERE completion_date IS NULL AND publication_date >= ?",
                Integer.class, Timestamp.from(started)) == 0);
    }

    private static Instant at(int day, String time) {
        return MONDAY.plusDays(day).atTime(LocalTime.parse(time)).atZone(WARSAW).toInstant();
    }

    private static String id(ResultActions result) throws Exception {
        return JsonPath.read(result.andReturn().getResponse().getContentAsString(), "$.id");
    }

    private ResultActions postJson(String path, Map<String, ?> body) throws Exception {
        return mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(path)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }

    private ResultActions bearer(String token, MockHttpServletRequestBuilder request) throws Exception {
        return mockMvc.perform(request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token));
    }

    private ResultActions as(UUID user, String role, MockHttpServletRequestBuilder request) throws Exception {
        return mockMvc.perform(request.with(jwt().jwt(token -> token.subject(user.toString()))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role))));
    }
}
