package pl.spotonslot.search;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Timestamp;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import pl.spotonslot.availability.Availability;
import pl.spotonslot.support.IntegrationTest;

@IntegrationTest
class SearchIntegrationTest {

    private static final ZoneId WARSAW = ZoneId.of("Europe/Warsaw");
    private static final String KRAKOW = "lat=50.0614&lng=19.9366";

    private static final UUID ALFA = UUID.fromString("0190a5d2-0000-7000-8000-0000000000f1");
    private static final UUID AAA = UUID.fromString("0190a5d2-0000-7000-8000-0000000000f2");
    private static final UUID BETA = UUID.fromString("0190a5d2-0000-7000-8000-0000000000f3");
    private static final UUID GAMMA = UUID.fromString("0190a5d2-0000-7000-8000-0000000000f4");
    private static final UUID DRAFT = UUID.fromString("0190a5d2-0000-7000-8000-0000000000f5");
    private static final UUID OWNER = UUID.fromString("0190a5d2-0000-7000-8000-0000000000f6");
    private static final UUID NOWHERE = UUID.fromString("0190a5d2-0000-7000-8000-0000000000f7");

    private static final UUID KLUB = UUID.fromString("0190a5d2-0000-7000-8000-0000000000a1");
    private static final UUID BAR = UUID.fromString("0190a5d2-0000-7000-8000-0000000000a2");
    private static final UUID DRAFT_VENUE = UUID.fromString("0190a5d2-0000-7000-8000-0000000000a3");
    private static final UUID WARSZAWA = UUID.fromString("0190a5d2-0000-7000-8000-0000000000a4");

    private static final UUID AVATAR = UUID.fromString("0190a5d2-0000-7000-8000-0000000000b1");

    /** A Monday at least a week ahead, so every test date is in the future. */
    private static final LocalDate MONDAY = LocalDate.now(WARSAW).plusWeeks(1).with(
            TemporalAdjusters.next(DayOfWeek.MONDAY));

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    Availability availability;

    @BeforeEach
    void seed() throws Exception {
        jdbc.update("DELETE FROM listing");
        jdbc.update("DELETE FROM availability_slot");
        jdbc.update("DELETE FROM availability_rule");
        jdbc.update("DELETE FROM artist_profile");
        jdbc.update("DELETE FROM venue");
        jdbc.update("DELETE FROM location");
        jdbc.update("DELETE FROM media WHERE id = ?", AVATAR);
        var now = Timestamp.from(Instant.now());
        jdbc.update("INSERT INTO media (id, created_at, updated_at, version, owner_id, width, height, small_key,"
                + " medium_key, large_key) VALUES (?, ?, ?, 0, ?, 800, 800, 'a-320.webp', 'a-800.webp',"
                + " 'a-1600.webp')", AVATAR, now, now, ALFA);

        artist(ALFA, "Alfa", "TECHNO", ", \"rateFrom\": 80000, \"rateTo\": 150000, \"travelRadiusKm\": 10,"
                + " \"avatarMediaId\": \"" + AVATAR + "\"", "Kraków", 50.06, 19.94, true);
        artist(AAA, "Aaa", "HOUSE", "", "Kraków", 50.06, 19.94, true);
        artist(BETA, "Beta", "HOUSE", ", \"travelRadiusKm\": 100", "Wieliczka", 49.99, 20.06, true);
        artist(GAMMA, "Gamma", "TECHNO", ", \"rateFrom\": 200000", "Tarnów", 50.01, 20.99, true);
        artist(DRAFT, "Delta", "TECHNO", "", "Kraków", 50.06, 19.94, false);
        location(OWNER, "Kraków", 50.06, 19.94);

        venue(KLUB, "klub", "Klub", "CLUB", "TECHNO", 300, 50.0617, 19.9372, true);
        venue(BAR, "bar", "Bar", "BAR", "HOUSE", null, 49.985, 20.054, true);
        venue(DRAFT_VENUE, "szkic", "Szkic", "CLUB", "TECHNO", null, 50.0617, 19.9372, false);
        venue(WARSZAWA, "stolica", "Stolica", "CLUB", "TECHNO", null, 52.23, 21.01, true);
    }

    @Test
    void artistsNearestFirstWithTheirCard() throws Exception {
        search(OWNER, "/artists?" + KRAKOW)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].slug", contains("aaa", "alfa", "beta")))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.content[1].stageName").value("Alfa"))
                .andExpect(jsonPath("$.content[1].city").value("Kraków"))
                .andExpect(jsonPath("$.content[1].genres", contains("TECHNO")))
                .andExpect(jsonPath("$.content[1].rateFrom").value(80000))
                .andExpect(jsonPath("$.content[1].rateTo").value(150000))
                .andExpect(jsonPath("$.content[1].travelRadiusKm").value(10))
                .andExpect(jsonPath("$.content[1].avatar.id").value(AVATAR.toString()))
                .andExpect(jsonPath("$.content[1].distanceKm").value(0.3))
                .andExpect(jsonPath("$.content[1].latitude").value(50.06))
                .andExpect(jsonPath("$.content[1].longitude").value(19.94))
                .andExpect(jsonPath("$.content[1].firstName").doesNotExist())
                .andExpect(jsonPath("$.content[0].avatar").doesNotExist());

        search(OWNER, "/artists?" + KRAKOW + "&radiusKm=100")
                .andExpect(jsonPath("$.content[*].slug", contains("aaa", "alfa", "beta", "gamma")));
        search(OWNER, "/artists?" + KRAKOW + "&radiusKm=5")
                .andExpect(jsonPath("$.content[*].slug", contains("aaa", "alfa")));
    }

    @Test
    void artistFilters() throws Exception {
        search(OWNER, "/artists?" + KRAKOW + "&radiusKm=100&genres=TECHNO")
                .andExpect(jsonPath("$.content[*].slug", contains("alfa", "gamma")));
        search(OWNER, "/artists?" + KRAKOW + "&radiusKm=100&genres=TECHNO&genres=HOUSE")
                .andExpect(jsonPath("$.content", hasSize(4)));
        // A rate "from" above the budget excludes; no rate at all does not.
        search(OWNER, "/artists?" + KRAKOW + "&radiusKm=100&budget=100000")
                .andExpect(jsonPath("$.content[*].slug", contains("aaa", "alfa", "beta")));
        // Only those whose travel radius reaches the centre: Alfa 10 km (0.3 km away), Aaa and Gamma 50 km,
        // Beta 100 km; Gamma is 75 km away.
        search(OWNER, "/artists?" + KRAKOW + "&radiusKm=100&willTravel=true")
                .andExpect(jsonPath("$.content[*].slug", contains("aaa", "alfa", "beta")));
        search(OWNER, "/artists?lat=49.99&lng=20.06&radiusKm=100&willTravel=true")
                .andExpect(jsonPath("$.content[*].slug", contains("beta", "aaa")));
    }

    @Test
    void artistsFreeAtTheGivenTime() throws Exception {
        slot(ALFA, at(4, "20:00"), at(5, "04:00"));
        as(BETA, "ARTIST", post("/api/v1/availability/me/rules").contentType(MediaType.APPLICATION_JSON)
                .content("{\"days\": [\"FRIDAY\"], \"startTime\": \"21:00\", \"durationMinutes\": 360,"
                        + " \"validFrom\": \"" + MONDAY + "\"}"))
                .andExpect(status().isCreated());
        slot(AAA, at(4, "20:00"), at(5, "04:00"));
        availability.occupy(AAA, at(4, "22:00"), at(5, "02:00"), UUID.randomUUID());

        search(OWNER, "/artists?" + KRAKOW + "&from=" + at(4, "22:00") + "&to=" + at(5, "02:00"))
                .andExpect(jsonPath("$.content[*].slug", contains("alfa", "beta")));
        search(OWNER, "/artists?" + KRAKOW + "&from=" + at(5, "22:00") + "&to=" + at(6, "02:00"))
                .andExpect(jsonPath("$.content").isEmpty());
        search(OWNER, "/artists?" + KRAKOW + "&from=" + at(4, "22:00"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("SEARCH_TIME_INVALID"));
        search(OWNER, "/artists?" + KRAKOW + "&from=" + at(5, "02:00") + "&to=" + at(4, "22:00"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("SEARCH_TIME_INVALID"));
    }

    @Test
    void venuesNearestFirstWithFilters() throws Exception {
        search(ALFA, "/venues?" + KRAKOW)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].slug", contains("klub", "bar")))
                .andExpect(jsonPath("$.content[0].name").value("Klub"))
                .andExpect(jsonPath("$.content[0].type").value("CLUB"))
                .andExpect(jsonPath("$.content[0].city").value("Kraków"))
                .andExpect(jsonPath("$.content[0].genres", contains("TECHNO")))
                .andExpect(jsonPath("$.content[0].capacity").value(300))
                .andExpect(jsonPath("$.content[0].latitude").value(50.0617))
                .andExpect(jsonPath("$.content[0].distanceKm").value(0.1));
        search(ALFA, "/venues?" + KRAKOW + "&genres=HOUSE")
                .andExpect(jsonPath("$.content[*].slug", contains("bar")));
        search(ALFA, "/venues?" + KRAKOW + "&types=CLUB&types=PUB")
                .andExpect(jsonPath("$.content[*].slug", contains("klub")));
        search(ALFA, "/venues?" + KRAKOW + "&radiusKm=200")
                .andExpect(jsonPath("$.content[*].slug", contains("klub", "bar")));
        search(ALFA, "/venues?lat=52.2&lng=21.0&radiusKm=10")
                .andExpect(jsonPath("$.content[*].slug", contains("stolica")));
    }

    @Test
    void listingsActiveWithPublishedAuthors() throws Exception {
        var free = listing("ARTIST_AVAILABLE", ALFA, null, at(4, "22:00"), at(5, "04:00"), 80000L, null, "TECHNO",
                50.06, 19.94, "ACTIVE");
        var seeking = listing("VENUE_SEEKING", null, KLUB, at(5, "21:00"), at(6, "03:00"), 50000L, 120000L,
                "HOUSE", 50.0617, 19.9372, "ACTIVE");
        var openBudget = listing("VENUE_SEEKING", null, BAR, at(11, "21:00"), at(12, "03:00"), null, null, "TECHNO",
                49.985, 20.054, "ACTIVE");
        listing("VENUE_SEEKING", null, KLUB, at(6, "21:00"), at(7, "03:00"), null, null, "TECHNO", 50.0617, 19.9372,
                "CLOSED");
        listing("VENUE_SEEKING", null, DRAFT_VENUE, at(6, "21:00"), at(7, "03:00"), null, null, "TECHNO", 50.0617,
                19.9372, "ACTIVE");
        listing("ARTIST_AVAILABLE", DRAFT, null, at(6, "21:00"), at(7, "03:00"), null, null, "TECHNO", 50.06, 19.94,
                "ACTIVE");
        listing("VENUE_SEEKING", null, KLUB, Instant.now().minusSeconds(3600), Instant.now().plusSeconds(3600), null,
                null, "TECHNO", 50.0617, 19.9372, "ACTIVE");

        search(OWNER, "/listings?" + KRAKOW)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].id", contains(seeking, free, openBudget)))
                .andExpect(jsonPath("$.content[0].kind").value("VENUE_SEEKING"))
                .andExpect(jsonPath("$.content[0].venue.slug").value("klub"))
                .andExpect(jsonPath("$.content[0].venue.name").value("Klub"))
                .andExpect(jsonPath("$.content[0].artist").doesNotExist())
                .andExpect(jsonPath("$.content[0].priceTo").value(120000))
                .andExpect(jsonPath("$.content[0].description").value("Opis"))
                .andExpect(jsonPath("$.content[0].city").value("Kraków"))
                .andExpect(jsonPath("$.content[1].artist.stageName").value("Alfa"))
                .andExpect(jsonPath("$.content[1].artist.slug").value("alfa"))
                .andExpect(jsonPath("$.content[1].startsAt").value(at(4, "22:00").toString()));

        search(OWNER, "/listings?" + KRAKOW + "&kind=ARTIST_AVAILABLE")
                .andExpect(jsonPath("$.content[*].id", contains(free)));
        search(OWNER, "/listings?" + KRAKOW + "&genres=TECHNO")
                .andExpect(jsonPath("$.content[*].id", contains(free, openBudget)));
        // Overlapping the time range.
        search(OWNER, "/listings?" + KRAKOW + "&from=" + at(5, "02:00") + "&to=" + at(5, "22:00"))
                .andExpect(jsonPath("$.content[*].id", contains(seeking, free)));
        // Seeking: their "up to" reaches the amount; free: their "from" stays within it; no amounts always match.
        search(OWNER, "/listings?" + KRAKOW + "&kind=VENUE_SEEKING&budget=100000")
                .andExpect(jsonPath("$.content[*].id", contains(seeking, openBudget)));
        search(OWNER, "/listings?" + KRAKOW + "&kind=VENUE_SEEKING&budget=130000")
                .andExpect(jsonPath("$.content[*].id", contains(openBudget)));
        search(OWNER, "/listings?" + KRAKOW + "&kind=ARTIST_AVAILABLE&budget=70000")
                .andExpect(jsonPath("$.content").isEmpty());
        search(OWNER, "/listings?" + KRAKOW + "&kind=ARTIST_AVAILABLE&budget=80000")
                .andExpect(jsonPath("$.content[*].id", contains(free)));
    }

    @Test
    void centreDefaultsToTheSearchersOwnLocation() throws Exception {
        search(OWNER, "/artists?radiusKm=5").andExpect(jsonPath("$.content[*].slug", contains("aaa", "alfa")));
        search(NOWHERE, "/venues")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("SEARCH_LOCATION_REQUIRED"));
        search(NOWHERE, "/venues?lat=50.06")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("SEARCH_CENTER_INCOMPLETE"));
        search(NOWHERE, "/venues?" + KRAKOW + "&radiusKm=201").andExpect(status().isBadRequest());
        search(NOWHERE, "/venues?lat=91&lng=19.9").andExpect(status().isBadRequest());
    }

    @Test
    void pagesKeepTheOrder() throws Exception {
        search(OWNER, "/artists?" + KRAKOW + "&radiusKm=100&size=3&page=1")
                .andExpect(jsonPath("$.content[*].slug", contains("gamma")))
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.size").value(3))
                .andExpect(jsonPath("$.totalElements").value(4))
                .andExpect(jsonPath("$.totalPages").value(2));
        search(OWNER, "/artists?" + KRAKOW + "&size=101").andExpect(status().isBadRequest());
        search(OWNER, "/artists?" + KRAKOW + "&sort=stageName").andExpect(status().isBadRequest());
    }

    @Test
    void onlyForSignedInUsers() throws Exception {
        mockMvc.perform(get("/api/v1/search/artists?" + KRAKOW)).andExpect(status().isUnauthorized());
        as(ALFA, "ARTIST", get("/api/v1/search/listings?" + KRAKOW)).andExpect(status().isOk());
    }

    private void artist(UUID owner, String name, String genre, String extra, String city, double latitude,
            double longitude, boolean published) throws Exception {
        as(owner, "ARTIST", put("/api/v1/artists/me").contentType(MediaType.APPLICATION_JSON)
                .content("{\"stageName\": \"" + name + "\", \"genres\": [\"" + genre + "\"]" + extra + "}"))
                .andExpect(status().isOk());
        location(owner, city, latitude, longitude);
        if (published) {
            jdbc.update("UPDATE artist_profile SET published_at = now() WHERE owner_id = ?", owner);
        }
    }

    private void location(UUID user, String city, double latitude, double longitude) {
        var now = Timestamp.from(Instant.now());
        jdbc.update("INSERT INTO location (id, created_at, updated_at, version, subject_type, subject_id, source,"
                + " precision, label, city, latitude, longitude) VALUES (?, ?, ?, 0, 'USER', ?, 'MANUAL',"
                + " 'APPROXIMATE', ?, ?, ?, ?)", UUID.randomUUID(), now, now, user, city, city, latitude, longitude);
    }

    private void venue(UUID id, String slug, String name, String type, String genre, Integer capacity,
            double latitude, double longitude, boolean published) {
        var now = Timestamp.from(Instant.now());
        jdbc.update("INSERT INTO venue (id, created_at, updated_at, version, slug, name, type, capacity, city,"
                + " latitude, longitude, published_at) VALUES (?, ?, ?, 0, ?, ?, ?, ?, 'Kraków', ?, ?, ?)",
                id, now, now, slug, name, type, capacity, latitude, longitude, published ? now : null);
        jdbc.update("INSERT INTO venue_genre (venue_id, genre) VALUES (?, ?)", id, genre);
    }

    private String listing(String kind, UUID artist, UUID venue, Instant startsAt, Instant endsAt, Long priceFrom,
            Long priceTo, String genre, double latitude, double longitude, String status) {
        var id = UUID.randomUUID();
        var now = Timestamp.from(Instant.now());
        jdbc.update("INSERT INTO listing (id, created_at, updated_at, version, kind, status, author_id, artist_id,"
                + " venue_id, starts_at, ends_at, description, price_from, price_to, city, latitude, longitude)"
                + " VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, 'Opis', ?, ?, 'Kraków', ?, ?)",
                id, now, now, kind, status, artist != null ? artist : OWNER, artist, venue, Timestamp.from(startsAt),
                Timestamp.from(endsAt), priceFrom, priceTo, latitude, longitude);
        jdbc.update("INSERT INTO listing_genre (listing_id, genre) VALUES (?, ?)", id, genre);
        return id.toString();
    }

    private void slot(UUID artist, Instant startsAt, Instant endsAt) throws Exception {
        as(artist, "ARTIST", post("/api/v1/availability/me/slots").contentType(MediaType.APPLICATION_JSON)
                .content("{\"startsAt\": \"" + startsAt + "\", \"endsAt\": \"" + endsAt + "\"}"))
                .andExpect(status().isCreated());
    }

    private Instant at(int daysAfterMonday, String time) {
        return MONDAY.plusDays(daysAfterMonday).atTime(LocalTime.parse(time)).atZone(WARSAW).toInstant();
    }

    private ResultActions search(UUID user, String path) throws Exception {
        return as(user, "VENUE", get("/api/v1/search" + path));
    }

    private ResultActions as(UUID user, String role, MockHttpServletRequestBuilder request) throws Exception {
        return mockMvc.perform(request.with(jwt().jwt(token -> token.subject(user.toString()))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role))));
    }
}
