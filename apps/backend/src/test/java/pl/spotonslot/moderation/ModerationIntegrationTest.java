package pl.spotonslot.moderation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jayway.jsonpath.JsonPath;
import jakarta.mail.MessagingException;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.UUID;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.context.ApplicationContext;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import pl.spotonslot.identity.AccountBlocked;
import pl.spotonslot.identity.AdminInvited;
import pl.spotonslot.identity.EmailVerificationRequested;
import pl.spotonslot.identity.application.AccountPurgeService;
import pl.spotonslot.support.IntegrationTest;

/**
 * Moderation end to end: the first admin from the configuration, reports with their limits and conversation copies,
 * hiding and restoring, closing listings, blocking accounts across modules, the history and the purge.
 */
@IntegrationTest
@RecordApplicationEvents
@TestPropertySource(properties = {
        "spotonslot.admin.email=Admin@Example.com",
        "spotonslot.admin.password=" + ModerationIntegrationTest.ADMIN_PASSWORD
})
class ModerationIntegrationTest {

    static final String ADMIN_PASSWORD = "admin password 123";
    private static final String ADMIN_EMAIL = "admin@example.com";
    private static final String PASSWORD = "correct horse battery";
    private static final ZoneId WARSAW = ZoneId.of("Europe/Warsaw");
    private static final UUID OWNER = UUID.fromString("0190a5d2-0000-7000-8000-0000000000a1");
    private static final UUID VENUE = UUID.fromString("0190a5d2-0000-7000-8000-0000000000b1");
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
    ApplicationContext context;

    @Autowired
    AccountPurgeService purge;

    Instant started;

    @BeforeEach
    void setUp() throws Exception {
        started = Instant.now();
        when(mailSender.createMimeMessage()).thenAnswer(invocation ->
                new MimeMessage(Session.getInstance(new Properties())));
        for (var table : List.of("moderation_report", "moderation_action", "notification", "conversation",
                "booking", "listing", "availability_slot", "availability_rule", "artist_profile", "location",
                "venue", "identity_refresh_token", "identity_token", "identity_user")) {
            jdbc.update("DELETE FROM " + table);
        }
        // Other tests empty the accounts too; the startup step creates the admin again.
        for (var runner : context.getBeansOfType(ApplicationRunner.class).values()) {
            runner.run(new DefaultApplicationArguments());
        }
        venue(VENUE, "pod-ziemia", "Pod Ziemią");
        member(VENUE, OWNER, "OWNER");
    }

    @AfterEach
    void awaitListeners() {
        awaitQuiet();
    }

    @Test
    void theConfiguredAdminSignsInAndOnlyAdminsReachThePanel() throws Exception {
        var admin = adminToken();
        bearer(admin, get("/api/v1/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("ADMIN"))
                .andExpect(jsonPath("$.email").value(ADMIN_EMAIL));
        bearer(admin, get("/api/v1/admin/reports")).andExpect(status().isOk());
        bearer(admin, get("/api/v1/admin/admins"))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].state").value("ACTIVE"));

        // A second run (a restart) leaves the account alone.
        for (var runner : context.getBeansOfType(ApplicationRunner.class).values()) {
            runner.run(new DefaultApplicationArguments());
        }
        assertThat(count("SELECT count(*) FROM identity_user WHERE role = 'ADMIN'")).isOne();

        var artist = signedIn("artist@example.com", "ARTIST");
        bearer(artist, get("/api/v1/admin/reports")).andExpect(status().isForbidden());
        bearer(artist, get("/api/v1/admin/users")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/admin/reports")).andExpect(status().isUnauthorized());
    }

    @Test
    void reportsHaveLimitsAndAreGroupedByTheReportedThing() throws Exception {
        var artist = signedIn("artist@example.com", "ARTIST");
        var artistId = me(artist);
        var slug = artistProfile(artist, artistId, "DJ Zgłaszający");

        report(artist, Map.of("kind", "VENUE", "slug", "pod-ziemia", "reason", "SPAM"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists());
        report(artist, Map.of("kind", "VENUE", "slug", "pod-ziemia", "reason", "FRAUD"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("MODERATION_ALREADY_REPORTED"));
        report(artist, Map.of("kind", "ARTIST", "slug", slug, "reason", "SPAM"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("MODERATION_OWN_TARGET"));
        report(artist, Map.of("kind", "ARTIST", "slug", "nikt", "reason", "SPAM"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("MODERATION_TARGET_NOT_FOUND"));
        report(artist, Map.of("kind", "VENUE", "reason", "SPAM"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("slug"));
        report(artist, Map.of("kind", "VENUE", "slug", "pod-ziemia", "reason", "OTHER"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("description"));

        // Another person's report of the same venue joins the same queue entry.
        as(OWNER, "VENUE", post("/api/v1/reports").contentType(MediaType.APPLICATION_JSON)
                .content("{\"kind\": \"ARTIST\", \"slug\": \"" + slug + "\", \"reason\": \"IMPERSONATION\"}"))
                .andExpect(status().isCreated());
        var other = signedIn("other@example.com", "ARTIST");
        report(other, Map.of("kind", "VENUE", "slug", "pod-ziemia", "reason", "OTHER", "description",
                "Nie płacą artystom")).andExpect(status().isCreated());

        var admin = adminToken();
        bearer(admin, get("/api/v1/admin/reports"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].kind").value("VENUE"))
                .andExpect(jsonPath("$.content[0].label").value("Pod Ziemią"))
                .andExpect(jsonPath("$.content[0].openCount").value(2))
                .andExpect(jsonPath("$.content[0].reasons", hasSize(2)))
                .andExpect(jsonPath("$.content[1].kind").value("ARTIST"));
        bearer(admin, get("/api/v1/admin/reports?kind=ARTIST"))
                .andExpect(jsonPath("$.totalElements").value(1));
        bearer(admin, get("/api/v1/admin/reports/count"))
                .andExpect(jsonPath("$.reports").value(3))
                .andExpect(jsonPath("$.targets").value(2));
        bearer(admin, get("/api/v1/admin/reports/VENUE/" + VENUE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.venue.name").value("Pod Ziemią"))
                .andExpect(jsonPath("$.reports", hasSize(2)))
                .andExpect(jsonPath("$.reports[0].reporterEmail").value("other@example.com"))
                .andExpect(jsonPath("$.reports[0].description").value("Nie płacą artystom"));

        // Dismissing closes them with a note and shows in the history.
        bearer(admin, post("/api/v1/admin/reports/VENUE/" + VENUE + "/dismiss")
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\": \"Brak naruszenia\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reports[0].status").value("DISMISSED"))
                .andExpect(jsonPath("$.reports[0].resolutionNote").value("Brak naruszenia"))
                .andExpect(jsonPath("$.actions[0].type").value("DISMISS_REPORTS"));
        bearer(admin, get("/api/v1/admin/actions"))
                .andExpect(jsonPath("$.content[0].type").value("DISMISS_REPORTS"))
                .andExpect(jsonPath("$.content[0].adminEmail").value(ADMIN_EMAIL))
                .andExpect(jsonPath("$.content[0].subjectLabel").value("Pod Ziemią"));
        // Once dismissed the same person may report it again.
        report(artist, Map.of("kind", "VENUE", "slug", "pod-ziemia", "reason", "FRAUD"))
                .andExpect(status().isCreated());

        // At most 10 a Warsaw day.
        var now = Timestamp.from(Instant.now());
        for (var i = 0; i < 8; i++) {
            jdbc.update("INSERT INTO moderation_report (id, created_at, updated_at, version, reporter_id, kind,"
                    + " target_id, owner_ids, label, reason, status) VALUES (?, ?, ?, 0, ?, 'ARTIST', ?,"
                    + " ARRAY[?]::uuid[], 'X', 'SPAM', 'RESOLVED')", UUID.randomUUID(), now, now, artistId,
                    UUID.randomUUID(), UUID.randomUUID());
        }
        as(artistId, "ARTIST", post("/api/v1/reports").contentType(MediaType.APPLICATION_JSON)
                .content("{\"kind\": \"VENUE\", \"slug\": \"pod-ziemia\", \"reason\": \"SPAM\"}"))
                .andExpect(status().isConflict());
        jdbc.update("UPDATE moderation_report SET status = 'DISMISSED' WHERE reporter_id = ?", artistId);
        report(artist, Map.of("kind", "VENUE", "slug", "pod-ziemia", "reason", "SPAM"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("MODERATION_REPORT_LIMIT"));

        // The data export lists what the person reported.
        bearer(other, get("/api/v1/me/export"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reports", hasSize(1)))
                .andExpect(jsonPath("$.reports[0].label").value("Pod Ziemią"))
                .andExpect(jsonPath("$.reports[0].reason").value("OTHER"));
    }

    @Test
    void aConversationReportKeepsTheNewestTwentyMessagesForTheAdmin() throws Exception {
        var artist = signedIn("artist@example.com", "ARTIST");
        var artistId = me(artist);
        artistProfile(artist, artistId, "DJ Rozmowny");
        var conversation = id(bearer(artist, post("/api/v1/conversations").contentType(MediaType.APPLICATION_JSON)
                .content("{\"venueSlug\": \"pod-ziemia\", \"body\": \"Wiadomość 0\"}"))
                .andExpect(status().isCreated()));
        for (var i = 1; i <= 21; i++) {
            var sender = i % 2 == 0 ? bearer(artist, send(conversation, "Wiadomość " + i))
                    : as(OWNER, "VENUE", send(conversation, "Wiadomość " + i));
            sender.andExpect(status().isCreated());
        }

        var stranger = signedIn("stranger@example.com", "ARTIST");
        report(stranger, Map.of("kind", "CONVERSATION", "id", conversation, "reason", "SPAM"))
                .andExpect(status().isNotFound());
        report(artist, Map.of("kind", "CONVERSATION", "id", conversation, "reason", "OFFENSIVE"))
                .andExpect(status().isCreated());

        bearer(adminToken(), get("/api/v1/admin/reports/CONVERSATION/" + conversation))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.label").value("Pod Ziemią"))
                .andExpect(jsonPath("$.owners", hasSize(0)))
                .andExpect(jsonPath("$.reports[0].messages", hasSize(20)))
                .andExpect(jsonPath("$.reports[0].messages[0].body").value("Wiadomość 2"))
                .andExpect(jsonPath("$.reports[0].messages[0].reporter").value(true))
                .andExpect(jsonPath("$.reports[0].messages[19].body").value("Wiadomość 21"))
                .andExpect(jsonPath("$.reports[0].messages[19].side").value("VENUE"));
        assertThat(jdbc.queryForObject("SELECT owner_ids[1] FROM moderation_report", UUID.class)).isEqualTo(OWNER);

        // Purging the reporter keeps the report without them and their side of the copy.
        bearer(artist, post("/api/v1/me/deletion").contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\": \"" + PASSWORD + "\", \"confirm\": true}"))
                .andExpect(status().isAccepted());
        awaitQuiet();
        purge.purgeDue(Instant.now().plus(Duration.ofDays(15)));
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> assertThat(count(
                "SELECT count(*) FROM moderation_report WHERE reporter_id IS NULL")).isOne());
        awaitQuiet();
        bearer(adminToken(), get("/api/v1/admin/reports/CONVERSATION/" + conversation))
                .andExpect(jsonPath("$.reports[0].reporterId").doesNotExist())
                .andExpect(jsonPath("$.reports[0].messages[0].body").value(""))
                .andExpect(jsonPath("$.reports[0].messages[0].deleted").value(true))
                .andExpect(jsonPath("$.reports[0].messages[19].body").value("Wiadomość 21"));
    }

    @Test
    void aHiddenProfileCannotBePublishedUntilAnAdminRestoresIt() throws Exception {
        var artist = signedIn("artist@example.com", "ARTIST");
        var artistId = me(artist);
        var slug = artistProfile(artist, artistId, "DJ Ukryty");
        as(OWNER, "VENUE", post("/api/v1/reports").contentType(MediaType.APPLICATION_JSON)
                .content("{\"kind\": \"ARTIST\", \"slug\": \"" + slug + "\", \"reason\": \"OFFENSIVE\"}"))
                .andExpect(status().isCreated());
        var profileId = jdbc.queryForObject("SELECT id FROM artist_profile WHERE owner_id = ?", UUID.class, artistId);
        var admin = adminToken();

        bearer(admin, post("/api/v1/admin/artists/" + profileId + "/restore").contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\": \"x\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("MODERATION_NOT_HIDDEN"));
        bearer(admin, post("/api/v1/admin/artists/" + profileId + "/hide").contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\": \"\"}"))
                .andExpect(status().isBadRequest());
        bearer(admin, post("/api/v1/admin/artists/" + profileId + "/hide").contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\": \"Obraźliwe zdjęcia\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.published").value(false))
                .andExpect(jsonPath("$.hiddenReason").value("Obraźliwe zdjęcia"));

        mockMvc.perform(get("/api/v1/public/artists/" + slug)).andExpect(status().isNotFound());
        bearer(artist, get("/api/v1/artists/me"))
                .andExpect(jsonPath("$.moderation.reason").value("Obraźliwe zdjęcia"))
                .andExpect(jsonPath("$.moderation.hiddenAt").exists());
        bearer(artist, post("/api/v1/artists/me/publish"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ARTIST_HIDDEN_BY_MODERATION"));
        assertThat(jdbc.queryForObject("SELECT status FROM moderation_report", String.class)).isEqualTo("RESOLVED");
        bearer(admin, get("/api/v1/admin/reports/count")).andExpect(jsonPath("$.reports").value(0));

        bearer(admin, post("/api/v1/admin/artists/" + profileId + "/restore").contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\": \"Zdjęcia zmienione\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hiddenAt").doesNotExist());
        bearer(artist, get("/api/v1/artists/me")).andExpect(jsonPath("$.moderation").doesNotExist());
        bearer(artist, post("/api/v1/artists/me/publish"))
                .andExpect(jsonPath("$.code").value("ARTIST_PROFILE_INCOMPLETE"));

        bearer(admin, get("/api/v1/admin/users/" + artistId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.artist.slug").value(slug))
                .andExpect(jsonPath("$.user.reportsTotal").value(1))
                .andExpect(jsonPath("$.actions", hasSize(2)))
                .andExpect(jsonPath("$.actions[0].type").value("RESTORE"))
                .andExpect(jsonPath("$.actions[1].type").value("HIDE"))
                .andExpect(jsonPath("$.actions[1].reason").value("Obraźliwe zdjęcia"));
    }

    @Test
    void aHiddenVenueStaysUnpublishedForItsTeam() throws Exception {
        var admin = adminToken();
        bearer(admin, post("/api/v1/admin/venues/" + VENUE + "/hide").contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\": \"Fałszywy lokal\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.published").value(false))
                .andExpect(jsonPath("$.team[0]").value(OWNER.toString()));
        mockMvc.perform(get("/api/v1/public/venues/pod-ziemia")).andExpect(status().isNotFound());
        as(OWNER, "VENUE", get("/api/v1/venues/" + VENUE))
                .andExpect(jsonPath("$.moderation.reason").value("Fałszywy lokal"));
        as(OWNER, "VENUE", post("/api/v1/venues/" + VENUE + "/publish"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VENUE_HIDDEN_BY_MODERATION"));
        bearer(admin, post("/api/v1/admin/venues/" + VENUE + "/restore").contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\": \"Zweryfikowany\"}"))
                .andExpect(status().isOk());
        as(OWNER, "VENUE", get("/api/v1/venues/" + VENUE)).andExpect(jsonPath("$.moderation").doesNotExist());
    }

    @Test
    void anAdminClosesAListingAndItsAuthorSeesWhy() throws Exception {
        var artist = signedIn("artist@example.com", "ARTIST");
        artistProfile(artist, me(artist), "DJ Ogłaszający");
        slot(artist, 3);
        var listing = id(bearer(artist, post("/api/v1/listings/mine").contentType(MediaType.APPLICATION_JSON)
                .content("{\"startsAt\": \"" + at(3, "21:00") + "\", \"endsAt\": \"" + at(4, "01:00")
                        + "\", \"genres\": [\"TECHNO\"]}"))
                .andExpect(status().isCreated()));
        as(OWNER, "VENUE", post("/api/v1/reports").contentType(MediaType.APPLICATION_JSON)
                .content("{\"kind\": \"LISTING\", \"id\": \"" + listing + "\", \"reason\": \"MISLEADING\"}"))
                .andExpect(status().isCreated());
        var admin = adminToken();
        bearer(admin, get("/api/v1/admin/reports/LISTING/" + listing))
                .andExpect(jsonPath("$.listing.status").value("ACTIVE"))
                .andExpect(jsonPath("$.listing.artist.stageName").value("DJ Ogłaszający"));

        bearer(admin, post("/api/v1/admin/listings/" + listing + "/close").contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\": \"Nieprawdziwe informacje\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CLOSED"));
        bearer(artist, get("/api/v1/listings/" + listing))
                .andExpect(jsonPath("$.status").value("CLOSED"))
                .andExpect(jsonPath("$.moderationReason").value("Nieprawdziwe informacje"));
        mockMvc.perform(get("/api/v1/public/listings/" + listing)).andExpect(status().isNotFound());
        bearer(admin, post("/api/v1/admin/listings/" + listing + "/close").contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\": \"Jeszcze raz\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("MODERATION_ALREADY_CLOSED"));
        assertThat(jdbc.queryForObject("SELECT status FROM moderation_report", String.class)).isEqualTo("RESOLVED");
    }

    @Test
    void blockingSignsOutHidesCancelsAndTellsThePerson() throws Exception {
        var login = loginResult("artist@example.com", "ARTIST");
        var artist = accessToken(login);
        var refresh = login.getResponse().getCookie("sos_refresh").getValue();
        var artistId = me(artist);
        var slug = artistProfile(artist, artistId, "DJ Zablokowany");
        slot(artist, 3);
        slot(artist, 5);
        var booking = id(as(OWNER, "VENUE", post("/api/v1/bookings").contentType(MediaType.APPLICATION_JSON)
                .content("{\"venueId\": \"" + VENUE + "\", \"artistSlug\": \"" + slug + "\", \"startsAt\": \""
                        + at(3, "21:00") + "\", \"endsAt\": \"" + at(4, "01:00") + "\", \"amount\": 100000}"))
                .andExpect(status().isCreated()));
        bearer(artist, post("/api/v1/bookings/" + booking + "/accept").contentType(MediaType.APPLICATION_JSON)
                .content("{\"revision\": 1}")).andExpect(status().isOk());
        var listing = id(bearer(artist, post("/api/v1/listings/mine").contentType(MediaType.APPLICATION_JSON)
                .content("{\"startsAt\": \"" + at(5, "21:00") + "\", \"endsAt\": \"" + at(6, "01:00")
                        + "\", \"genres\": [\"TECHNO\"]}"))
                .andExpect(status().isCreated()));
        as(OWNER, "VENUE", post("/api/v1/reports").contentType(MediaType.APPLICATION_JSON)
                .content("{\"kind\": \"LISTING\", \"id\": \"" + listing + "\", \"reason\": \"FRAUD\"}"))
                .andExpect(status().isCreated());
        awaitQuiet();
        var admin = adminToken();
        var adminId = me(admin);

        bearer(admin, post("/api/v1/admin/users/" + adminId + "/block").contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\": \"Test\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ADMIN_CANNOT_BLOCK_SELF"));
        bearer(admin, post("/api/v1/admin/users/" + artistId + "/block").contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\": \"Oszustwa wobec lokali\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.account.state").value("BLOCKED"))
                .andExpect(jsonPath("$.account.blockReason").value("Oszustwa wobec lokali"));

        // Signed out at once, everywhere.
        bearer(artist, get("/api/v1/me"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("IDENTITY_ACCOUNT_BLOCKED"));
        mockMvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie("sos_refresh", refresh)))
                .andExpect(status().isUnauthorized());
        postJson("/api/v1/auth/login", Map.of("email", "artist@example.com", "password", PASSWORD))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("IDENTITY_ACCOUNT_BLOCKED"));

        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> {
            assertThat(statusOf("booking", booking)).isEqualTo("CANCELLED");
            assertThat(statusOf("listing", listing)).isEqualTo("CLOSED");
            assertThat(count("SELECT count(*) FROM artist_profile WHERE owner_id = ? AND published_at IS NULL",
                    artistId)).isOne();
        });
        awaitQuiet();
        assertThat(jdbc.queryForObject("SELECT message FROM booking_step WHERE booking_id = ?::uuid"
                + " AND type = 'CANCELLED'", String.class, booking)).isEqualTo("Konto zostało zablokowane");
        assertThat(jdbc.queryForList("SELECT payload ->> 'kind' FROM notification WHERE recipient_id = ?",
                String.class, OWNER)).contains("CANCELLED");
        assertThat(jdbc.queryForObject("SELECT status FROM moderation_report", String.class)).isEqualTo("RESOLVED");
        assertThat(events.stream(AccountBlocked.class)).singleElement()
                .satisfies(event -> assertThat(event.reason()).isEqualTo("Oszustwa wobec lokali"));
        var sent = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, atLeastOnce()).send(sent.capture());
        assertThat(sent.getAllValues()).map(ModerationIntegrationTest::subject)
                .contains("Twoje konto w Spot On Slot zostało zablokowane");

        bearer(admin, get("/api/v1/admin/users?state=BLOCKED"))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].account.email").value("artist@example.com"));
        bearer(admin, get("/api/v1/admin/users?q=zablokowany"))
                .andExpect(jsonPath("$.totalElements").value(1));

        bearer(admin, post("/api/v1/admin/users/" + artistId + "/unblock").contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\": \"Wyjaśnione\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.account.state").value("ACTIVE"));
        var again = accessToken(postJson("/api/v1/auth/login", Map.of("email", "artist@example.com", "password",
                PASSWORD)).andExpect(status().isOk()).andReturn());
        bearer(again, get("/api/v1/artists/me")).andExpect(jsonPath("$.publishedAt").doesNotExist());
        bearer(admin, get("/api/v1/admin/users/" + artistId))
                .andExpect(jsonPath("$.actions[0].type").value("UNBLOCK_ACCOUNT"))
                .andExpect(jsonPath("$.actions[1].type").value("BLOCK_ACCOUNT"));
    }

    @Test
    void anAdminAddsAnotherAdminWhoSetsAPasswordThroughTheLink() throws Exception {
        var admin = adminToken();
        bearer(admin, post("/api/v1/admin/admins").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\": \"artist@example.com\"}"))
                .andExpect(status().isCreated());
        signedIn("taken@example.com", "ARTIST");
        bearer(admin, post("/api/v1/admin/admins").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\": \"taken@example.com\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ADMIN_EMAIL_TAKEN"));

        var token = events.stream(AdminInvited.class).reduce((first, second) -> second).orElseThrow().token();
        postJson("/api/v1/auth/login", Map.of("email", "artist@example.com", "password", PASSWORD))
                .andExpect(status().isUnauthorized());
        postJson("/api/v1/auth/password-reset/confirm", Map.of("token", token, "password", PASSWORD))
                .andExpect(status().isNoContent());
        var second = accessToken(postJson("/api/v1/auth/login", Map.of("email", "artist@example.com",
                "password", PASSWORD)).andExpect(status().isOk()).andReturn());
        bearer(second, get("/api/v1/admin/admins"))
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[1].state").value("ACTIVE"));
        bearer(admin, get("/api/v1/admin/actions")).andExpect(jsonPath("$.content[0].type").value("ADD_ADMIN"));
    }

    // ---- helpers

    private String adminToken() throws Exception {
        return accessToken(postJson("/api/v1/auth/login", Map.of("email", ADMIN_EMAIL, "password", ADMIN_PASSWORD))
                .andExpect(status().isOk()).andReturn());
    }

    private String signedIn(String email, String role) throws Exception {
        return accessToken(loginResult(email, role));
    }

    private MvcResult loginResult(String email, String role) throws Exception {
        postJson("/api/v1/auth/register", Map.of("email", email, "password", PASSWORD, "role", role, "locale", "pl",
                "privacyNoticeAccepted", true, "acceptTerms", true)).andExpect(status().isAccepted());
        var token = events.stream(EmailVerificationRequested.class).filter(event -> event.email().equals(email))
                .reduce((first, second) -> second).orElseThrow().token();
        postJson("/api/v1/auth/verify-email", Map.of("token", token)).andExpect(status().isNoContent());
        return postJson("/api/v1/auth/login", Map.of("email", email, "password", PASSWORD))
                .andExpect(status().isOk()).andReturn();
    }

    private static String accessToken(MvcResult result) throws Exception {
        return JsonPath.read(result.getResponse().getContentAsString(), "$.accessToken");
    }

    private UUID me(String token) throws Exception {
        return UUID.fromString(JsonPath.read(bearer(token, get("/api/v1/me")).andReturn().getResponse()
                .getContentAsString(), "$.id"));
    }

    /** A published profile with a location. Returns the slug. */
    private String artistProfile(String token, UUID artist, String stageName) throws Exception {
        bearer(token, put("/api/v1/artists/me").contentType(MediaType.APPLICATION_JSON)
                .content("{\"stageName\": \"" + stageName + "\", \"genres\": [\"TECHNO\"]}"))
                .andExpect(status().isOk());
        var now = Timestamp.from(Instant.now());
        jdbc.update("INSERT INTO location (id, created_at, updated_at, version, subject_type, subject_id, source,"
                + " precision, label, city, latitude, longitude) VALUES (?, ?, ?, 0, 'USER', ?, 'MANUAL',"
                + " 'APPROXIMATE', 'Kraków', 'Kraków', 50.06, 19.94)", UUID.randomUUID(), now, now, artist);
        jdbc.update("UPDATE artist_profile SET published_at = now() WHERE owner_id = ?", artist);
        return jdbc.queryForObject("SELECT slug FROM artist_profile WHERE owner_id = ?", String.class, artist);
    }

    private void venue(UUID id, String slug, String name) {
        var now = Timestamp.from(Instant.now());
        jdbc.update("INSERT INTO venue (id, created_at, updated_at, version, slug, name, type, city, latitude,"
                + " longitude, published_at) VALUES (?, ?, ?, 0, ?, ?, 'CLUB', 'Kraków', 50.0617, 19.9372, ?)",
                id, now, now, slug, name, now);
    }

    private void member(UUID venue, UUID user, String role) {
        var now = Timestamp.from(Instant.now());
        jdbc.update("INSERT INTO venue_member (id, created_at, updated_at, version, venue_id, user_id, role)"
                + " VALUES (?, ?, ?, 0, ?, ?, ?)", UUID.randomUUID(), now, now, venue, user, role);
    }

    /** A free evening on day {@code day} after next Monday, 20:00 to 04:00. */
    private void slot(String token, int day) throws Exception {
        bearer(token, post("/api/v1/availability/me/slots").contentType(MediaType.APPLICATION_JSON)
                .content("{\"startsAt\": \"" + at(day, "20:00") + "\", \"endsAt\": \"" + at(day + 1, "04:00")
                        + "\"}"))
                .andExpect(status().isCreated());
    }

    private MockHttpServletRequestBuilder send(String conversation, String body) {
        return post("/api/v1/conversations/" + conversation + "/messages").contentType(MediaType.APPLICATION_JSON)
                .content("{\"body\": \"" + body + "\"}");
    }

    private ResultActions report(String token, Map<String, ?> body) throws Exception {
        return bearer(token, post("/api/v1/reports").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)));
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

    private static String subject(MimeMessage message) {
        try {
            return message.getSubject();
        } catch (MessagingException e) {
            throw new IllegalStateException(e);
        }
    }

    private ResultActions postJson(String path, Map<String, ?> body) throws Exception {
        return mockMvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }

    private ResultActions bearer(String token, MockHttpServletRequestBuilder request) throws Exception {
        return mockMvc.perform(request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token));
    }

    private ResultActions as(UUID user, String role, MockHttpServletRequestBuilder request) throws Exception {
        return mockMvc.perform(request.with(jwt().jwt(token -> token.subject(user.toString()))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role))));
    }
}
