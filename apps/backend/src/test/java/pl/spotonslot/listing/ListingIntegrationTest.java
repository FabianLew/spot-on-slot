package pl.spotonslot.listing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.sql.Timestamp;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;
import java.util.function.BooleanSupplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import pl.spotonslot.availability.Availability;
import pl.spotonslot.listing.application.ListingService;
import pl.spotonslot.support.IntegrationTest;

@IntegrationTest
@RecordApplicationEvents
class ListingIntegrationTest {

    private static final ZoneId WARSAW = ZoneId.of("Europe/Warsaw");
    private static final UUID ARTIST = UUID.fromString("0190a5d2-0000-7000-8000-0000000000d1");
    private static final UUID OTHER_ARTIST = UUID.fromString("0190a5d2-0000-7000-8000-0000000000d2");
    private static final UUID OWNER = UUID.fromString("0190a5d2-0000-7000-8000-0000000000d3");
    private static final UUID MANAGER = UUID.fromString("0190a5d2-0000-7000-8000-0000000000d4");
    private static final UUID OUTSIDER = UUID.fromString("0190a5d2-0000-7000-8000-0000000000d5");
    private static final UUID VENUE = UUID.fromString("0190a5d2-0000-7000-8000-0000000000e1");
    private static final UUID DRAFT_VENUE = UUID.fromString("0190a5d2-0000-7000-8000-0000000000e2");

    /** A Monday at least a week ahead, so every test date is in the future. */
    private static final LocalDate MONDAY = LocalDate.now(WARSAW).plusWeeks(1).with(
            TemporalAdjusters.next(DayOfWeek.MONDAY));

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    Availability availability;

    @Autowired
    ListingService listingService;

    @Autowired
    ApplicationEvents events;

    @BeforeEach
    void clean() throws Exception {
        jdbc.update("DELETE FROM listing");
        jdbc.update("DELETE FROM availability_slot");
        jdbc.update("DELETE FROM availability_rule");
        jdbc.update("DELETE FROM artist_profile");
        jdbc.update("DELETE FROM location WHERE subject_id IN (?, ?)", ARTIST, OTHER_ARTIST);
        jdbc.update("DELETE FROM venue");
        for (var artist : List.of(ARTIST, OTHER_ARTIST)) {
            as(artist, "ARTIST", put("/api/v1/artists/me").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"stageName\": \"DJ " + artist.toString().substring(34) + "\", \"travelRadiusKm\": 80}"))
                    .andExpect(status().isOk());
            var now = Timestamp.from(Instant.now());
            jdbc.update("INSERT INTO location (id, created_at, updated_at, version, subject_type, subject_id, source,"
                    + " precision, label, city, latitude, longitude) VALUES (?, ?, ?, 0, 'USER', ?, 'MANUAL',"
                    + " 'APPROXIMATE', 'Kraków', 'Kraków', 50.06, 19.94)", UUID.randomUUID(), now, now, artist);
        }
        jdbc.update("UPDATE artist_profile SET published_at = now() WHERE owner_id = ?", ARTIST);
        venue(VENUE, "pod-ziemia", "Pod Ziemią", true);
        venue(DRAFT_VENUE, "szkic", "Szkic", false);
        member(VENUE, OWNER, "OWNER");
        member(VENUE, MANAGER, "MANAGER");
        member(DRAFT_VENUE, OWNER, "OWNER");
    }

    @Test
    void artistsAnnounceFreeTimeFromTheirCalendar() throws Exception {
        addSlot(ARTIST, at(4, "22:00"), at(5, "04:00"));

        var id = id(announce(ARTIST, at(4, "22:00"), at(5, "04:00"), ", \"priceFrom\": 80000, \"priceTo\": 150000")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.kind").value("ARTIST_AVAILABLE"))
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.startsAt").value(at(4, "22:00").toString()))
                .andExpect(jsonPath("$.genres", contains("TECHNO")))
                .andExpect(jsonPath("$.description").value("Gram techno"))
                .andExpect(jsonPath("$.priceFrom").value(80000))
                .andExpect(jsonPath("$.city").value("Kraków"))
                .andExpect(jsonPath("$.travelRadiusKm").value(80))
                .andExpect(jsonPath("$.artist.stageName").value("DJ d1"))
                .andExpect(jsonPath("$.venue").doesNotExist()));

        assertThat(events.stream(ListingPublished.class)).singleElement().satisfies(event -> {
            assertThat(event.listingId()).hasToString(id);
            assertThat(event.kind()).isEqualTo(ListingKind.ARTIST_AVAILABLE);
            assertThat(event.point().latitude()).isEqualTo(50.06);
        });
        as(ARTIST, "ARTIST", get("/api/v1/listings/mine"))
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].id").value(id));
        as(OTHER_ARTIST, "ARTIST", get("/api/v1/listings/mine")).andExpect(jsonPath("$.content").isEmpty());
    }

    @Test
    void announcedTimeMustBeFreeAndNotAnnouncedTwice() throws Exception {
        announce(ARTIST, at(4, "22:00"), at(5, "02:00"), "")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("LISTING_NOT_FREE"));

        addSlot(ARTIST, at(4, "22:00"), at(5, "04:00"));
        announce(ARTIST, at(4, "22:00"), at(5, "04:00"), "").andExpect(status().isCreated());
        announce(ARTIST, at(4, "23:00"), at(5, "02:00"), "")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("LISTING_DUPLICATE"));
    }

    @Test
    void needsAPublishedArtistProfile() throws Exception {
        addSlot(OTHER_ARTIST, at(4, "22:00"), at(5, "04:00"));
        announce(OTHER_ARTIST, at(4, "22:00"), at(5, "04:00"), "")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("LISTING_PROFILE_REQUIRED"));
        as(OWNER, "VENUE", get("/api/v1/listings/mine")).andExpect(status().isForbidden());
    }

    @Test
    void artistListingsExpireWhenTheirTimeLeavesTheCalendar() throws Exception {
        var slot = addSlot(ARTIST, at(4, "22:00"), at(5, "04:00"));
        var fromSlot = id(announce(ARTIST, at(4, "22:00"), at(5, "04:00"), ""));
        as(ARTIST, "ARTIST", post("/api/v1/availability/me/rules").contentType(MediaType.APPLICATION_JSON)
                .content("{\"days\": [\"SATURDAY\"], \"startTime\": \"21:00\", \"durationMinutes\": 360,"
                        + " \"validFrom\": \"" + MONDAY + "\"}"))
                .andExpect(status().isCreated());
        var rule = JsonPath.read(as(ARTIST, "ARTIST", get("/api/v1/availability/me/rules")).andReturn()
                .getResponse().getContentAsString(), "$[0].id");
        // Rule dates last 6 elapsed hours, also over a clock change.
        var hours = Duration.ofHours(6);
        var fromRule = id(announce(ARTIST, at(5, "21:00"), at(5, "21:00").plus(hours), ""));
        var booked = id(announce(ARTIST, at(12, "21:00"), at(12, "21:00").plus(hours), ""));

        as(ARTIST, "ARTIST", delete("/api/v1/availability/me/slots/" + slot)).andExpect(status().isNoContent());
        as(ARTIST, "ARTIST", delete("/api/v1/availability/me/rules/" + rule + "/dates/" + MONDAY.plusDays(5)))
                .andExpect(status().isOk());
        availability.occupy(ARTIST, at(12, "22:00"), at(13, "01:00"), UUID.randomUUID());

        for (var id : List.of(fromSlot, fromRule, booked)) {
            await(() -> "EXPIRED".equals(jdbc.queryForObject("SELECT status FROM listing WHERE id = ?::uuid",
                    String.class, id)));
        }
        as(ARTIST, "ARTIST", get("/api/v1/listings/" + fromSlot)).andExpect(jsonPath("$.status").value("EXPIRED"));
    }

    @Test
    void venueTeamsLookForArtists() throws Exception {
        var id = id(seek(OWNER, VENUE, at(4, "20:00"), at(5, "02:00"), ", \"priceFrom\": 100000")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.kind").value("VENUE_SEEKING"))
                .andExpect(jsonPath("$.venue.name").value("Pod Ziemią"))
                .andExpect(jsonPath("$.venue.slug").value("pod-ziemia"))
                .andExpect(jsonPath("$.city").value("Kraków"))
                .andExpect(jsonPath("$.priceFrom").value(100000))
                .andExpect(jsonPath("$.priceTo").doesNotExist())
                .andExpect(jsonPath("$.artist").doesNotExist()));
        // A second stage on the same evening is fine; managers may post too.
        seek(MANAGER, VENUE, at(4, "20:00"), at(5, "02:00"), "").andExpect(status().isCreated());

        as(MANAGER, "VENUE", get("/api/v1/venues/" + VENUE + "/listings"))
                .andExpect(jsonPath("$.content", hasSize(2)));
        seek(OUTSIDER, VENUE, at(4, "20:00"), at(5, "02:00"), "")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("LISTING_VENUE_NOT_FOUND"));
        as(OUTSIDER, "VENUE", get("/api/v1/listings/" + id)).andExpect(status().isNotFound());
        seek(OWNER, DRAFT_VENUE, at(4, "20:00"), at(5, "02:00"), "")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("LISTING_VENUE_NOT_PUBLISHED"));
        as(ARTIST, "ARTIST", post("/api/v1/venues/" + VENUE + "/listings").contentType(MediaType.APPLICATION_JSON)
                .content(body(at(4, "20:00"), at(5, "02:00"), ""))).andExpect(status().isForbidden());
        assertThat(events.stream(ListingPublished.class)).hasSize(2);
    }

    @Test
    void checksTimesGenresAndPrices() throws Exception {
        seek(OWNER, VENUE, at(4, "20:00"), at(4, "20:15"), "")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("LISTING_DURATION_INVALID"));
        seek(OWNER, VENUE, Instant.now().minusSeconds(3600), Instant.now().plusSeconds(3600), "")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("LISTING_IN_PAST"));
        seek(OWNER, VENUE, at(400, "20:00"), at(400, "23:00"), "")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("LISTING_TOO_FAR"));
        seek(OWNER, VENUE, at(4, "20:00"), at(4, "23:00"), ", \"priceFrom\": 200000, \"priceTo\": 100000")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("LISTING_PRICE_ORDER"));
        as(OWNER, "VENUE", post("/api/v1/venues/" + VENUE + "/listings").contentType(MediaType.APPLICATION_JSON)
                .content("{\"startsAt\": \"" + at(4, "20:00") + "\", \"endsAt\": \"" + at(4, "23:00")
                        + "\", \"genres\": []}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void authorsEditAndCloseActiveListings() throws Exception {
        var id = id(seek(OWNER, VENUE, at(4, "20:00"), at(5, "02:00"), ""));

        as(MANAGER, "VENUE", put("/api/v1/listings/" + id).contentType(MediaType.APPLICATION_JSON)
                .content("{\"startsAt\": \"" + at(4, "21:00") + "\", \"endsAt\": \"" + at(5, "03:00")
                        + "\", \"genres\": [\"HOUSE\", \"TECHNO\"], \"description\": \"Dwie sale\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.startsAt").value(at(4, "21:00").toString()))
                .andExpect(jsonPath("$.genres", contains("TECHNO", "HOUSE")))
                .andExpect(jsonPath("$.description").value("Dwie sale"));
        as(OUTSIDER, "VENUE", post("/api/v1/listings/" + id + "/close")).andExpect(status().isNotFound());
        as(OWNER, "VENUE", post("/api/v1/listings/" + id + "/close"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CLOSED"));
        as(OWNER, "VENUE", put("/api/v1/listings/" + id).contentType(MediaType.APPLICATION_JSON)
                .content(body(at(4, "21:00"), at(5, "03:00"), "")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("LISTING_NOT_ACTIVE"));

        addSlot(ARTIST, at(4, "22:00"), at(5, "04:00"));
        var own = id(announce(ARTIST, at(4, "22:00"), at(5, "04:00"), ""));
        as(OTHER_ARTIST, "ARTIST", post("/api/v1/listings/" + own + "/close")).andExpect(status().isNotFound());
        // Moving an artist's listing needs free time again.
        as(ARTIST, "ARTIST", put("/api/v1/listings/" + own).contentType(MediaType.APPLICATION_JSON)
                .content(body(at(6, "22:00"), at(7, "02:00"), "")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("LISTING_NOT_FREE"));
    }

    @Test
    void limitsActiveListingsPerVenueAndArtist() throws Exception {
        for (int i = 0; i < 30; i++) {
            seek(OWNER, VENUE, at(i + 1, "20:00"), at(i + 1, "23:00"), "").andExpect(status().isCreated());
        }
        seek(MANAGER, VENUE, at(40, "20:00"), at(40, "23:00"), "")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("LISTING_LIMIT_REACHED"));

        for (int i = 0; i < 21; i++) {
            addSlot(ARTIST, at(i + 1, "20:00"), at(i + 1, "23:00"));
        }
        for (int i = 0; i < 20; i++) {
            announce(ARTIST, at(i + 1, "20:00"), at(i + 1, "23:00"), "").andExpect(status().isCreated());
        }
        announce(ARTIST, at(21, "20:00"), at(21, "23:00"), "")
                .andExpect(jsonPath("$.code").value("LISTING_LIMIT_REACHED"));
    }

    @Test
    void activeListingsArePublicWithoutPrivateData() throws Exception {
        addSlot(ARTIST, at(4, "22:00"), at(5, "04:00"));
        var artistListing = id(announce(ARTIST, at(4, "22:00"), at(5, "04:00"), ""));
        var venueListing = id(seek(OWNER, VENUE, at(4, "20:00"), at(5, "02:00"), ""));

        mockMvc.perform(get("/api/v1/public/listings/" + artistListing))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.artist.slug").isNotEmpty())
                .andExpect(jsonPath("$.authorId").doesNotExist())
                .andExpect(jsonPath("$.latitude").doesNotExist());
        mockMvc.perform(get("/api/v1/public/listings/" + venueListing))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.venue.name").value("Pod Ziemią"));

        as(OWNER, "VENUE", post("/api/v1/listings/" + venueListing + "/close")).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/public/listings/" + venueListing))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("LISTING_NOT_FOUND"));
        jdbc.update("UPDATE artist_profile SET published_at = NULL WHERE owner_id = ?", ARTIST);
        mockMvc.perform(get("/api/v1/public/listings/" + artistListing)).andExpect(status().isNotFound());
    }

    @Test
    void listingsExpireOnceTheyStart() throws Exception {
        var id = id(seek(OWNER, VENUE, at(4, "20:00"), at(5, "02:00"), ""));
        jdbc.update("UPDATE listing SET starts_at = now() - interval '1 hour' WHERE id = ?::uuid", id);

        // Reads treat it as expired before the job runs, and the job then stores it.
        as(OWNER, "VENUE", get("/api/v1/listings/" + id)).andExpect(jsonPath("$.status").value("EXPIRED"));
        mockMvc.perform(get("/api/v1/public/listings/" + id)).andExpect(status().isNotFound());
        assertThat(listingService.expireStarted()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT status FROM listing WHERE id = ?::uuid", String.class, id))
                .isEqualTo("EXPIRED");
        as(OWNER, "VENUE", get("/api/v1/venues/" + VENUE + "/listings").param("status", "ACTIVE"))
                .andExpect(jsonPath("$.content").isEmpty());
    }

    private Instant at(int daysAfterMonday, String time) {
        return MONDAY.plusDays(daysAfterMonday).atTime(LocalTime.parse(time)).atZone(WARSAW).toInstant();
    }

    private String addSlot(UUID artist, Instant startsAt, Instant endsAt) throws Exception {
        return id(as(artist, "ARTIST", post("/api/v1/availability/me/slots").contentType(MediaType.APPLICATION_JSON)
                .content("{\"startsAt\": \"" + startsAt + "\", \"endsAt\": \"" + endsAt + "\"}"))
                .andExpect(status().isCreated()));
    }

    private static String body(Instant startsAt, Instant endsAt, String extra) {
        return "{\"startsAt\": \"" + startsAt + "\", \"endsAt\": \"" + endsAt
                + "\", \"genres\": [\"TECHNO\"], \"description\": \"Gram techno\"" + extra + "}";
    }

    private ResultActions announce(UUID artist, Instant startsAt, Instant endsAt, String extra) throws Exception {
        return as(artist, "ARTIST", post("/api/v1/listings/mine").contentType(MediaType.APPLICATION_JSON)
                .content(body(startsAt, endsAt, extra)));
    }

    private ResultActions seek(UUID user, UUID venue, Instant startsAt, Instant endsAt, String extra)
            throws Exception {
        return as(user, "VENUE", post("/api/v1/venues/" + venue + "/listings").contentType(MediaType.APPLICATION_JSON)
                .content(body(startsAt, endsAt, extra)));
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

    private static String id(ResultActions result) throws Exception {
        return JsonPath.read(result.andReturn().getResponse().getContentAsString(), "$.id");
    }

    private ResultActions as(UUID user, String role, MockHttpServletRequestBuilder request) throws Exception {
        return mockMvc.perform(request.with(jwt().jwt(token -> token.subject(user.toString()))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role))));
    }

    private static void await(BooleanSupplier condition) throws InterruptedException {
        var deadline = Instant.now().plus(Duration.ofSeconds(10));
        while (!condition.getAsBoolean()) {
            if (Instant.now().isAfter(deadline)) {
                throw new AssertionError("Condition not met within 10 s");
            }
            Thread.sleep(50);
        }
    }
}
