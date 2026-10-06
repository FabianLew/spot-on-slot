package pl.spotonslot.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.never;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.support.TransactionTemplate;
import pl.spotonslot.availability.Availability;
import pl.spotonslot.support.IntegrationTest;

@IntegrationTest
class NearbyListingAlertIntegrationTest {

    private static final ZoneId WARSAW = ZoneId.of("Europe/Warsaw");

    // Artists: Alfa (Kraków, techno, travels 10 km), Beta (Wieliczka, house, 100 km), Gamma (Tarnów, techno, 50 km),
    // Far (Tarnów, techno, 100 km), Draft (Kraków, techno, unpublished).
    private static final UUID ALFA = UUID.fromString("0190a5d2-0000-7000-8000-0000000001f1");
    private static final UUID BETA = UUID.fromString("0190a5d2-0000-7000-8000-0000000001f2");
    private static final UUID GAMMA = UUID.fromString("0190a5d2-0000-7000-8000-0000000001f3");
    private static final UUID FAR = UUID.fromString("0190a5d2-0000-7000-8000-0000000001f4");
    private static final UUID DRAFT = UUID.fromString("0190a5d2-0000-7000-8000-0000000001f5");

    // Venue people: Owner owns Klub; Manager is in Klub and Piwnica; Barman owns Bar; Stołeczny owns Stolica.
    private static final UUID OWNER = UUID.fromString("0190a5d2-0000-7000-8000-0000000001e1");
    private static final UUID MANAGER = UUID.fromString("0190a5d2-0000-7000-8000-0000000001e2");
    private static final UUID BARMAN = UUID.fromString("0190a5d2-0000-7000-8000-0000000001e3");
    private static final UUID STOLECZNY = UUID.fromString("0190a5d2-0000-7000-8000-0000000001e4");

    // Venues: Klub (Kraków, techno), Piwnica (Wieliczka, techno), Bar (Wieliczka, house), Stolica (Warszawa, techno).
    private static final UUID KLUB = UUID.fromString("0190a5d2-0000-7000-8000-0000000001a1");
    private static final UUID PIWNICA = UUID.fromString("0190a5d2-0000-7000-8000-0000000001a2");
    private static final UUID BAR = UUID.fromString("0190a5d2-0000-7000-8000-0000000001a3");
    private static final UUID STOLICA = UUID.fromString("0190a5d2-0000-7000-8000-0000000001a4");

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
    Availability availability;

    @Autowired
    ApplicationEventPublisher events;

    @Autowired
    TransactionTemplate transactions;

    @BeforeEach
    void seed() throws Exception {
        when(mailSender.createMimeMessage())
                .thenAnswer(invocation -> new MimeMessage(Session.getInstance(new Properties())));
        jdbc.update("DELETE FROM notification_preference");
        jdbc.update("DELETE FROM notification");
        jdbc.update("DELETE FROM listing");
        jdbc.update("DELETE FROM availability_slot");
        jdbc.update("DELETE FROM availability_rule");
        jdbc.update("DELETE FROM artist_profile");
        jdbc.update("DELETE FROM venue");
        jdbc.update("DELETE FROM location");
        jdbc.update("DELETE FROM identity_user WHERE email LIKE '%@alerts.example.com'");

        artist(ALFA, "Alfa", "TECHNO", 10, "Kraków", 50.06, 19.94, true);
        artist(BETA, "Beta", "HOUSE", 100, "Wieliczka", 49.99, 20.06, true);
        artist(GAMMA, "Gamma", "TECHNO", 50, "Tarnów", 50.01, 20.99, true);
        artist(FAR, "Far", "TECHNO", 100, "Tarnów", 50.01, 20.99, true);
        artist(DRAFT, "Draft", "TECHNO", 50, "Kraków", 50.06, 19.94, false);
        for (var person : List.of(OWNER, MANAGER, BARMAN, STOLECZNY)) {
            account(person, "VENUE", "pl");
        }

        venue(KLUB, "klub", "Klub", "TECHNO", "Kraków", 50.0617, 19.9372, OWNER, MANAGER);
        venue(PIWNICA, "piwnica", "Piwnica", "TECHNO", "Wieliczka", 49.985, 20.054, MANAGER);
        venue(BAR, "bar", "Bar", "HOUSE", "Wieliczka", 49.985, 20.054, BARMAN);
        venue(STOLICA, "stolica", "Stolica", "TECHNO", "Warszawa", 52.23, 21.01, STOLECZNY);
    }

    @Test
    void venueLookingForAnArtistAlertsArtistsWhoseTravelRadiusReachesItAndWhoPlayTheGenre() throws Exception {
        var listing = seek(KLUB, OWNER, at(4, "20:00"), at(5, "02:00"), "TECHNO", "");

        // Alfa: 0.3 km within 10 km; Far: 76 km within 100 km. Gamma's 50 km does not reach, Beta plays house,
        // Draft is unpublished.
        awaitAlerts(listing, 2);
        assertThat(recipients(listing)).containsExactlyInAnyOrder(ALFA, FAR);

        as(ALFA, "ARTIST", get("/api/v1/notifications"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].type").value("NEARBY_LISTING"))
                .andExpect(jsonPath("$.content[0].readAt").doesNotExist())
                .andExpect(jsonPath("$.content[0].active").value(true))
                .andExpect(jsonPath("$.content[0].nearbyListing.listingId").value(listing))
                .andExpect(jsonPath("$.content[0].nearbyListing.kind").value("VENUE_SEEKING"))
                .andExpect(jsonPath("$.content[0].nearbyListing.authorName").value("Klub"))
                .andExpect(jsonPath("$.content[0].nearbyListing.authorSlug").value("klub"))
                .andExpect(jsonPath("$.content[0].nearbyListing.city").value("Kraków"))
                .andExpect(jsonPath("$.content[0].nearbyListing.distanceKm").value(1))
                .andExpect(jsonPath("$.content[0].nearbyListing.genres", contains("TECHNO")))
                .andExpect(jsonPath("$.content[0].nearbyListing.priceTo").value(150000))
                .andExpect(jsonPath("$.content[0].nearbyListing.free").value(false));
        as(FAR, "ARTIST", get("/api/v1/notifications"))
                .andExpect(jsonPath("$.content[0].nearbyListing.distanceKm").value(76));
    }

    @Test
    void artistsBookedAtThatTimeAreSkippedAndFreeOnesAreTold() throws Exception {
        slot(ALFA, at(4, "18:00"), at(5, "04:00"));
        slot(FAR, at(4, "19:00"), at(5, "03:00"));
        availability.occupy(ALFA, at(4, "22:00"), at(5, "02:00"), UUID.randomUUID());

        var listing = seek(KLUB, OWNER, at(4, "20:00"), at(5, "02:00"), "TECHNO", "");

        awaitAlerts(listing, 1);
        assertThat(recipients(listing)).containsExactly(FAR);
        as(FAR, "ARTIST", get("/api/v1/notifications"))
                .andExpect(jsonPath("$.content[0].nearbyListing.free").value(true));

        // Booked time that does not overlap the listing does not matter.
        var afternoon = seek(KLUB, OWNER, at(5, "14:00"), at(5, "18:00"), "TECHNO", "");
        awaitAlerts(afternoon, 2);
        assertThat(recipients(afternoon)).containsExactlyInAnyOrder(ALFA, FAR);
    }

    @Test
    void artistFreeAlertsVenueTeamsWithinTheirTravelRadiusOncePerPerson() throws Exception {
        slot(ALFA, at(4, "18:00"), at(5, "04:00"));
        var listing = announce(ALFA, at(4, "20:00"), at(5, "02:00"), "TECHNO", ", \"travelRadiusKm\": 100");

        // Klub (0.3 km) and Piwnica (8 km) play techno; Bar plays house; Stolica is 250 km away.
        // Manager is in Klub and Piwnica and hears once, about the nearest one.
        awaitAlerts(listing, 2);
        assertThat(recipients(listing)).containsExactlyInAnyOrder(OWNER, MANAGER);
        as(MANAGER, "VENUE", get("/api/v1/notifications"))
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].nearbyListing.kind").value("ARTIST_AVAILABLE"))
                .andExpect(jsonPath("$.content[0].nearbyListing.authorName").value("Alfa"))
                .andExpect(jsonPath("$.content[0].nearbyListing.authorSlug").value("alfa"))
                .andExpect(jsonPath("$.content[0].nearbyListing.venueName").value("Klub"))
                .andExpect(jsonPath("$.content[0].nearbyListing.distanceKm").value(1))
                .andExpect(jsonPath("$.content[0].nearbyListing.free").doesNotExist());

        // Within 5 km only Klub's team; nobody in the artist's own place gets their own alert.
        slot(BETA, at(4, "18:00"), at(5, "04:00"));
        var near = announce(BETA, at(4, "20:00"), at(5, "02:00"), "HOUSE", ", \"travelRadiusKm\": 5");
        awaitAlerts(near, 1);
        assertThat(recipients(near)).containsExactly(BARMAN);
    }

    @Test
    void preferencesTurnAlertsOffAndNarrowRadiusAndGenres() throws Exception {
        preferences(ALFA, "ARTIST", false, true, null, "")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nearbyListings.enabled").value(false));
        preferences(FAR, "ARTIST", true, true, 50, "").andExpect(status().isOk());
        preferences(GAMMA, "ARTIST", true, true, 100, "\"TECHNO\", \"HOUSE\"").andExpect(status().isOk());
        preferences(BETA, "ARTIST", true, true, null, "\"TECHNO\"").andExpect(status().isOk());

        var listing = seek(KLUB, OWNER, at(4, "20:00"), at(5, "02:00"), "TECHNO", "");

        // Alfa switched off, Far narrowed to 50 km; Gamma widened to 100 km; Beta follows techno now.
        awaitAlerts(listing, 2);
        assertThat(recipients(listing)).containsExactlyInAnyOrder(GAMMA, BETA);
    }

    @Test
    void preferencesShowDefaultsFromTheProfileAndAreValidated() throws Exception {
        as(ALFA, "ARTIST", get("/api/v1/notifications/preferences"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nearbyListings.enabled").value(true))
                .andExpect(jsonPath("$.nearbyListings.email").value(true))
                .andExpect(jsonPath("$.nearbyListings.radiusKm").doesNotExist())
                .andExpect(jsonPath("$.nearbyListings.genres", hasSize(0)))
                .andExpect(jsonPath("$.nearbyListings.defaultRadiusKm").value(10))
                .andExpect(jsonPath("$.nearbyListings.defaultGenres", contains("TECHNO")));
        as(MANAGER, "VENUE", get("/api/v1/notifications/preferences"))
                .andExpect(jsonPath("$.nearbyListings.defaultRadiusKm").value(50))
                .andExpect(jsonPath("$.nearbyListings.defaultGenres", contains("TECHNO")));

        preferences(ALFA, "ARTIST", true, false, 300, "").andExpect(status().isBadRequest());
        preferences(ALFA, "ARTIST", true, false, 25, "\"HOUSE\"")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nearbyListings.email").value(false))
                .andExpect(jsonPath("$.nearbyListings.radiusKm").value(25))
                .andExpect(jsonPath("$.nearbyListings.genres", contains("HOUSE")));
        as(ALFA, "ARTIST", get("/api/v1/notifications/preferences"))
                .andExpect(jsonPath("$.nearbyListings.radiusKm").value(25));
    }

    @Test
    void readingNotifications() throws Exception {
        var first = seek(KLUB, OWNER, at(4, "20:00"), at(5, "02:00"), "TECHNO", "");
        var second = seek(KLUB, OWNER, at(5, "20:00"), at(6, "02:00"), "TECHNO", "");
        awaitAlerts(first, 2);
        awaitAlerts(second, 2);

        as(ALFA, "ARTIST", get("/api/v1/notifications/unread-count")).andExpect(jsonPath("$.count").value(2));
        var body = as(ALFA, "ARTIST", get("/api/v1/notifications"))
                .andExpect(jsonPath("$.content[*].nearbyListing.listingId", contains(second, first)))
                .andReturn().getResponse().getContentAsString();
        String newest = JsonPath.read(body, "$.content[0].id");

        as(FAR, "ARTIST", post("/api/v1/notifications/" + newest + "/read")).andExpect(status().isNotFound());
        as(ALFA, "ARTIST", post("/api/v1/notifications/" + newest + "/read")).andExpect(status().isNoContent());
        as(ALFA, "ARTIST", get("/api/v1/notifications/unread-count")).andExpect(jsonPath("$.count").value(1));
        as(ALFA, "ARTIST", get("/api/v1/notifications"))
                .andExpect(jsonPath("$.content[0].readAt").exists())
                .andExpect(jsonPath("$.content[1].readAt").doesNotExist());

        as(ALFA, "ARTIST", post("/api/v1/notifications/read-all")).andExpect(status().isNoContent());
        as(ALFA, "ARTIST", get("/api/v1/notifications/unread-count")).andExpect(jsonPath("$.count").value(0));
        as(FAR, "ARTIST", get("/api/v1/notifications/unread-count")).andExpect(jsonPath("$.count").value(2));

        // A listing that ended reads as no longer current.
        as(OWNER, "VENUE", post("/api/v1/listings/" + first + "/close")).andExpect(status().isOk());
        as(ALFA, "ARTIST", get("/api/v1/notifications"))
                .andExpect(jsonPath("$.content[0].active").value(true))
                .andExpect(jsonPath("$.content[1].active").value(false));

        mockMvc.perform(get("/api/v1/notifications")).andExpect(status().isUnauthorized());
    }

    @Test
    void alertEmailInTheRecipientsLanguageWithUnsubscribeLink() throws Exception {
        account(FAR, "ARTIST", "en");
        account(ALFA, "ARTIST", "pl");

        var listing = seek(KLUB, OWNER, at(4, "20:00"), at(5, "02:00"), "TECHNO", "");

        var messages = captureMails(2);
        var polish = messages.stream().filter(message -> to(message).equals(email(ALFA))).findFirst().orElseThrow();
        assertThat(polish.getSubject()).startsWith("Klub szuka artysty: ");
        var text = part(polish, "text/plain");
        assertThat(text)
                .contains("Kraków, 1 km od Ciebie")
                .contains("Techno")
                .contains("do 1\u00a0500 zł")
                .contains("http://localhost:3000/o/" + listing)
                .contains("http://localhost:3000/unsubscribe?token=");
        assertThat(part(polish, "text/html")).contains("href=\"http://localhost:3000/o/" + listing + "\"");
        var token = text.substring(text.indexOf("unsubscribe?token=") + 18).split("\\s")[0];
        assertThat(polish.getHeader("List-Unsubscribe")[0])
                .isEqualTo("<http://localhost:3000/unsubscribe?token=" + token + ">");
        assertThat(polish.getHeader("List-Unsubscribe-Post")[0]).isEqualTo("List-Unsubscribe=One-Click");

        var english = messages.stream().filter(message -> to(message).equals(email(FAR))).findFirst().orElseThrow();
        assertThat(english.getSubject()).startsWith("Klub is looking for an artist: ");
        assertThat(part(english, "text/plain")).contains("Kraków, 76 km from you");

        // The link turns e-mails off without signing in; alerts in the app stay.
        mockMvc.perform(post("/api/v1/public/notifications/unsubscribe").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\": \"" + token + "\"}"))
                .andExpect(status().isNoContent());
        mockMvc.perform(post("/api/v1/public/notifications/unsubscribe").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\": \"nope\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOTIFICATION_UNSUBSCRIBE_INVALID"));
        as(ALFA, "ARTIST", get("/api/v1/notifications/preferences"))
                .andExpect(jsonPath("$.nearbyListings.enabled").value(true))
                .andExpect(jsonPath("$.nearbyListings.email").value(false));

        clearInvocations(mailSender);
        var next = seek(KLUB, OWNER, at(5, "20:00"), at(6, "02:00"), "TECHNO", "");
        awaitAlerts(next, 2);
        captureMails(1);
        awaitEventsDone();
        verify(mailSender, never()).send(org.mockito.ArgumentMatchers.argThat(
                (MimeMessage message) -> to(message).equals(email(ALFA))));
    }

    @Test
    void atMostFiveAlertEmailsADay() throws Exception {
        account(ALFA, "ARTIST", "pl");
        var listings = new ArrayList<String>();
        for (int day = 0; day < 6; day++) {
            listings.add(seek(KLUB, OWNER, at(day, "20:00"), at(day + 1, "02:00"), "TECHNO", ""));
        }
        listings.forEach(listing -> awaitAlerts(listing, 2));
        awaitEventsDone();

        verify(mailSender, timeout(5_000).times(5)).send(any(MimeMessage.class));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM notification WHERE recipient_id = ?"
                + " AND email_sent_at IS NOT NULL", Integer.class, ALFA)).isEqualTo(5);
        as(ALFA, "ARTIST", get("/api/v1/notifications/unread-count")).andExpect(jsonPath("$.count").value(6));
    }

    @Test
    void noEmailWhenTheListingEndedBeforeItWentOut() throws Exception {
        account(ALFA, "ARTIST", "pl");
        var listing = seek(KLUB, OWNER, at(4, "20:00"), at(5, "02:00"), "TECHNO", "");
        awaitAlerts(listing, 2);
        captureMails(1);
        awaitEventsDone();
        as(OWNER, "VENUE", post("/api/v1/listings/" + listing + "/close")).andExpect(status().isOk());

        // The same notification once more, as if the e-mail had not gone out yet.
        clearInvocations(mailSender);
        var id = jdbc.queryForObject("SELECT id FROM notification WHERE recipient_id = ?", UUID.class, ALFA);
        jdbc.update("UPDATE notification SET email_sent_at = NULL WHERE id = ?", id);
        transactions.executeWithoutResult(status -> events.publishEvent(
                new NotificationCreated(id, ALFA, NotificationType.NEARBY_LISTING)));
        awaitEventsDone();
        verify(mailSender, never()).send(any(MimeMessage.class));
    }

    @Test
    void oldNotificationsAreDeleted(@Autowired pl.spotonslot.notification.application.NotificationService service)
            throws Exception {
        var listing = seek(KLUB, OWNER, at(4, "20:00"), at(5, "02:00"), "TECHNO", "");
        awaitAlerts(listing, 2);
        jdbc.update("UPDATE notification SET created_at = ? WHERE recipient_id = ?",
                Timestamp.from(Instant.now().minus(Duration.ofDays(91))), ALFA);

        assertThat(service.deleteOld()).isEqualTo(1);
        assertThat(recipients(listing)).containsExactly(FAR);
    }

    // ---- helpers

    private void awaitAlerts(String listing, int count) {
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() -> assertThat(recipients(listing)).hasSize(count));
        // Nothing more arrives once the listing's event is done.
        awaitEventsDone();
        assertThat(recipients(listing)).hasSize(count);
    }

    private void awaitEventsDone() {
        await().atMost(Duration.ofSeconds(10)).until(() -> jdbc.queryForObject(
                "SELECT count(*) FROM event_publication WHERE completion_date IS NULL"
                        + " AND (event_type LIKE '%ListingPublished' OR event_type LIKE '%NotificationCreated')",
                Integer.class) == 0);
    }

    private List<UUID> recipients(String listing) {
        return jdbc.queryForList("SELECT recipient_id FROM notification WHERE listing_id = ?", UUID.class,
                UUID.fromString(listing));
    }

    private List<MimeMessage> captureMails(int count) throws Exception {
        var captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, timeout(10_000).times(count)).send(captor.capture());
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

    private static String email(UUID user) {
        return user.toString().substring(30) + "@alerts.example.com";
    }

    private void account(UUID id, String role, String locale) {
        var now = Timestamp.from(Instant.now());
        jdbc.update("DELETE FROM identity_user WHERE id = ?", id);
        jdbc.update("INSERT INTO identity_user (id, created_at, updated_at, version, email, password_hash, role,"
                + " status, locale, privacy_notice_accepted_at, email_verified_at) VALUES (?, ?, ?, 0, ?, 'x', ?,"
                + " 'ACTIVE', ?, ?, ?)", id, now, now, email(id), role, locale, now, now);
    }

    private void artist(UUID owner, String name, String genre, int travelRadiusKm, String city, double latitude,
            double longitude, boolean published) throws Exception {
        as(owner, "ARTIST", put("/api/v1/artists/me").contentType(MediaType.APPLICATION_JSON)
                .content("{\"stageName\": \"" + name + "\", \"genres\": [\"" + genre + "\"], \"travelRadiusKm\": "
                        + travelRadiusKm + "}"))
                .andExpect(status().isOk());
        var now = Timestamp.from(Instant.now());
        jdbc.update("INSERT INTO location (id, created_at, updated_at, version, subject_type, subject_id, source,"
                + " precision, label, city, latitude, longitude) VALUES (?, ?, ?, 0, 'USER', ?, 'MANUAL',"
                + " 'APPROXIMATE', ?, ?, ?, ?)", UUID.randomUUID(), now, now, owner, city, city, latitude, longitude);
        if (published) {
            jdbc.update("UPDATE artist_profile SET published_at = now() WHERE owner_id = ?", owner);
        }
    }

    private void venue(UUID id, String slug, String name, String genre, String city, double latitude,
            double longitude, UUID... team) {
        var now = Timestamp.from(Instant.now());
        jdbc.update("INSERT INTO venue (id, created_at, updated_at, version, slug, name, type, city, latitude,"
                + " longitude, published_at) VALUES (?, ?, ?, 0, ?, ?, 'CLUB', ?, ?, ?, ?)",
                id, now, now, slug, name, city, latitude, longitude, now);
        jdbc.update("INSERT INTO venue_genre (venue_id, genre) VALUES (?, ?)", id, genre);
        for (int i = 0; i < team.length; i++) {
            jdbc.update("INSERT INTO venue_member (id, created_at, updated_at, version, venue_id, user_id, role)"
                    + " VALUES (?, ?, ?, 0, ?, ?, ?)", UUID.randomUUID(), now, now, id, team[i],
                    i == 0 ? "OWNER" : "MANAGER");
        }
    }

    private String seek(UUID venue, UUID user, Instant startsAt, Instant endsAt, String genre, String extra)
            throws Exception {
        return listingId(as(user, "VENUE", post("/api/v1/venues/" + venue + "/listings")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(startsAt, endsAt, genre, ", \"priceTo\": 150000" + extra))));
    }

    private String announce(UUID artist, Instant startsAt, Instant endsAt, String genre, String extra)
            throws Exception {
        return listingId(as(artist, "ARTIST", post("/api/v1/listings/mine").contentType(MediaType.APPLICATION_JSON)
                .content(body(startsAt, endsAt, genre, extra))));
    }

    private static String body(Instant startsAt, Instant endsAt, String genre, String extra) {
        return "{\"startsAt\": \"" + startsAt + "\", \"endsAt\": \"" + endsAt + "\", \"genres\": [\"" + genre
                + "\"]" + extra + "}";
    }

    private static String listingId(ResultActions result) throws Exception {
        return JsonPath.read(result.andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(),
                "$.id");
    }

    private void slot(UUID artist, Instant startsAt, Instant endsAt) throws Exception {
        as(artist, "ARTIST", post("/api/v1/availability/me/slots").contentType(MediaType.APPLICATION_JSON)
                .content("{\"startsAt\": \"" + startsAt + "\", \"endsAt\": \"" + endsAt + "\"}"))
                .andExpect(status().isCreated());
    }

    private ResultActions preferences(UUID user, String role, boolean enabled, boolean email, Integer radiusKm,
            String genres) throws Exception {
        return as(user, role, put("/api/v1/notifications/preferences").contentType(MediaType.APPLICATION_JSON)
                .content("{\"nearbyListings\": {\"enabled\": " + enabled + ", \"email\": " + email
                        + ", \"radiusKm\": " + radiusKm + ", \"genres\": [" + genres + "]}}"));
    }

    private Instant at(int daysAfterMonday, String time) {
        return MONDAY.plusDays(daysAfterMonday).atTime(LocalTime.parse(time)).atZone(WARSAW).toInstant();
    }

    private ResultActions as(UUID user, String role, MockHttpServletRequestBuilder request) throws Exception {
        return mockMvc.perform(request.with(jwt().jwt(token -> token.subject(user.toString()))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role))));
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
