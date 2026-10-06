package pl.spotonslot.artist;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;
import java.util.function.BooleanSupplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import pl.spotonslot.location.GeoPoint;
import pl.spotonslot.location.application.LocationService;
import pl.spotonslot.location.domain.LocationSource;
import pl.spotonslot.media.application.MediaService;
import pl.spotonslot.support.IntegrationTest;

@IntegrationTest
class ArtistProfileIntegrationTest {

    private static final UUID ARTIST = UUID.fromString("0190a5d2-0000-7000-8000-0000000000b1");
    private static final UUID OTHER_ARTIST = UUID.fromString("0190a5d2-0000-7000-8000-0000000000b2");
    private static final UUID VENUE = UUID.fromString("0190a5d2-0000-7000-8000-0000000000b3");

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    LocationService locationService;

    @Autowired
    MediaService mediaService;

    @Autowired
    ArtistProfiles artistProfiles;

    @BeforeEach
    void clean() {
        jdbc.update("DELETE FROM artist_profile");
        jdbc.update("DELETE FROM media");
        jdbc.update("DELETE FROM location");
    }

    @Test
    void createsAProfileWithAnAddressFromTheStageName() throws Exception {
        save(ARTIST, """
                {"stageName": " Łukasz Żółć ", "firstName": "Łukasz", "lastName": "Kowalski", "bio": "Techno z Krakowa",
                 "genres": ["TECHNO", "HOUSE", "TECHNO"], "tags": ["vinyl", " Vinyl ", "warehouse"],
                 "links": {"soundcloud": "https://soundcloud.com/lukasz", "youtube": "https://www.youtube.com/@lukasz"},
                 "rateFrom": 150000, "rateTo": 300000, "travelRadiusKm": 120,
                 "skills": {"tempo": 8, "cdj": 9}}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slug").value("lukasz-zolc"))
                .andExpect(jsonPath("$.stageName").value("Łukasz Żółć"))
                .andExpect(jsonPath("$.genres", contains("TECHNO", "HOUSE")))
                .andExpect(jsonPath("$.tags", contains("vinyl", "warehouse")))
                .andExpect(jsonPath("$.links.soundcloud").value("https://soundcloud.com/lukasz"))
                .andExpect(jsonPath("$.links.spotify").doesNotExist())
                .andExpect(jsonPath("$.rate.from").value(150000))
                .andExpect(jsonPath("$.rate.currency").value("PLN"))
                .andExpect(jsonPath("$.travelRadiusKm").value(120))
                .andExpect(jsonPath("$.skills.tempo").value(8))
                .andExpect(jsonPath("$.skills.vinyl").doesNotExist())
                .andExpect(jsonPath("$.published").value(false))
                .andExpect(jsonPath("$.missingForPublication", contains("AVATAR", "LOCATION")));

        as(ARTIST, get("/api/v1/artists/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.firstName").value("Łukasz"))
                .andExpect(jsonPath("$.bio").value("Techno z Krakowa"));
    }

    @Test
    void savingAgainReplacesFieldsAndKeepsTheAddress() throws Exception {
        save(ARTIST, "{\"stageName\": \"Weronika\", \"genres\": [\"TECHNO\"], \"tags\": [\"vinyl\"]}")
                .andExpect(jsonPath("$.slug").value("weronika"));

        save(ARTIST, "{\"stageName\": \"Weronika K\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slug").value("weronika"))
                .andExpect(jsonPath("$.stageName").value("Weronika K"))
                .andExpect(jsonPath("$.genres").isEmpty())
                .andExpect(jsonPath("$.tags").isEmpty())
                .andExpect(jsonPath("$.travelRadiusKm").value(50))
                .andExpect(jsonPath("$.missingForPublication", contains("GENRE", "AVATAR", "LOCATION")));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM artist_profile", Long.class)).isEqualTo(1);
    }

    @Test
    void numbersTheAddressWhenTheNameIsTaken() throws Exception {
        save(ARTIST, "{\"stageName\": \"Weronika\"}").andExpect(jsonPath("$.slug").value("weronika"));
        save(OTHER_ARTIST, "{\"stageName\": \"weronika!\"}").andExpect(jsonPath("$.slug").value("weronika-2"));
    }

    @Test
    void artistsCanPickAFreeAddress() throws Exception {
        save(OTHER_ARTIST, "{\"stageName\": \"Other\", \"slug\": \"taken\"}").andExpect(status().isOk());
        save(ARTIST, "{\"stageName\": \"Weronika\"}").andExpect(status().isOk());

        as(ARTIST, get("/api/v1/artists/slugs/{slug}", "taken"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ARTIST_SLUG_TAKEN"));
        as(ARTIST, get("/api/v1/artists/slugs/{slug}", "admin"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ARTIST_SLUG_RESERVED"));
        as(ARTIST, get("/api/v1/artists/slugs/{slug}", "Bad--Slug")).andExpect(status().isBadRequest());
        as(ARTIST, get("/api/v1/artists/slugs/{slug}", "weronika")).andExpect(status().isNoContent());
        as(ARTIST, get("/api/v1/artists/slugs/{slug}", "dj-weronika")).andExpect(status().isNoContent());

        save(ARTIST, "{\"stageName\": \"Weronika\", \"slug\": \"taken\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ARTIST_SLUG_TAKEN"));
        save(ARTIST, "{\"stageName\": \"Weronika\", \"slug\": \"settings\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ARTIST_SLUG_RESERVED"));
        save(ARTIST, "{\"stageName\": \"Weronika\", \"slug\": \"dj-weronika\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slug").value("dj-weronika"));
    }

    @Test
    void rejectsInvalidFields() throws Exception {
        save(ARTIST, """
                {"stageName": "", "slug": "Zły", "genres": ["TECHNO", "HOUSE", "TRANCE", "DISCO", "FUNK", "POP"],
                 "tags": ["%s"], "links": {"instagram": "http://instagram.com/x", "spotify": "https://evil.com/x"},
                 "rateFrom": -1, "travelRadiusKm": 501, "skills": {"energy": 11}}
                """.formatted("x".repeat(31)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors[*].field", org.hamcrest.Matchers.hasItems("stageName", "slug", "genres",
                        "tags[0]", "links.instagram", "links.spotify", "rateFrom", "travelRadiusKm", "skills.energy")))
                .andExpect(jsonPath("$.errors[?(@.field == 'links.spotify')].message")
                        .value("Podaj link https do właściwego serwisu."));

        save(ARTIST, "{\"stageName\": \"W\", \"rateFrom\": 300000, \"rateTo\": 100000}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ARTIST_RATE_RANGE_INVALID"));
    }

    @Test
    void acceptsMobileAndShortLinks() throws Exception {
        save(ARTIST, """
                {"stageName": "W", "links": {"youtube": "https://youtu.be/abc", "instagram": "https://m.instagram.com/w",
                 "spotify": "https://open.spotify.com/artist/1"}}
                """).andExpect(status().isOk()).andExpect(jsonPath("$.links.youtube").value("https://youtu.be/abc"));
    }

    @Test
    void onlyArtistsHaveProfiles() throws Exception {
        save(VENUE, "VENUE", "{\"stageName\": \"Club\"}").andExpect(status().isForbidden());
        as(VENUE, "VENUE", get("/api/v1/artists/me")).andExpect(status().isForbidden());
        as(ARTIST, get("/api/v1/artists/me"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ARTIST_PROFILE_NOT_FOUND"));
        mockMvc.perform(get("/api/v1/artists/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void photosMustBelongToTheArtist() throws Exception {
        var mine = image(ARTIST);
        var theirs = image(OTHER_ARTIST);

        save(ARTIST, "{\"stageName\": \"W\", \"photoMediaIds\": [\"%s\", \"%s\"]}".formatted(mine, theirs))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ARTIST_MEDIA_NOT_OWNED"));
        save(ARTIST, "{\"stageName\": \"W\", \"avatarMediaId\": \"%s\"}".formatted(UUID.randomUUID()))
                .andExpect(jsonPath("$.code").value("ARTIST_MEDIA_NOT_OWNED"));

        save(ARTIST, "{\"stageName\": \"W\", \"avatarMediaId\": \"%s\", \"photoMediaIds\": [\"%s\"]}"
                .formatted(mine, mine))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatar.id").value(mine.toString()))
                .andExpect(jsonPath("$.avatar.medium", containsString("/media/" + mine + "/medium.webp")))
                .andExpect(jsonPath("$.photos[0].width").value(1600));
    }

    @Test
    void deletingAPhotoRemovesItFromTheProfile() throws Exception {
        var avatar = image(ARTIST);
        var photo = image(ARTIST);
        save(ARTIST, "{\"stageName\": \"W\", \"avatarMediaId\": \"%s\", \"photoMediaIds\": [\"%s\", \"%s\"]}"
                .formatted(avatar, photo, avatar)).andExpect(status().isOk());

        mediaService.delete(ARTIST, avatar);

        await(() -> jdbc.queryForObject("SELECT count(*) FROM artist_photo", Long.class) == 1
                && jdbc.queryForObject("SELECT count(*) FROM artist_profile WHERE avatar_media_id IS NULL", Long.class)
                        == 1);
        as(ARTIST, get("/api/v1/artists/me"))
                .andExpect(jsonPath("$.avatar").doesNotExist())
                .andExpect(jsonPath("$.photos[*].id", contains(photo.toString())));
    }

    @Test
    void publishesOnlyACompleteProfile() throws Exception {
        save(ARTIST, "{\"stageName\": \"Weronika\", \"genres\": [\"TECHNO\"]}").andExpect(status().isOk());
        as(ARTIST, post("/api/v1/artists/me/publish"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ARTIST_PROFILE_INCOMPLETE"));

        makePublishable(ARTIST);
        as(ARTIST, post("/api/v1/artists/me/publish"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.published").value(true))
                .andExpect(jsonPath("$.publishedAt").isNotEmpty())
                .andExpect(jsonPath("$.missingForPublication").isEmpty())
                .andExpect(jsonPath("$.location.label").value("Kraków, małopolskie"));
        assertThat(artistProfiles.findPublishedByOwner(ARTIST))
                .contains(new ArtistSummary(ARTIST, "weronika", "Weronika", 50));

        as(ARTIST, post("/api/v1/artists/me/unpublish"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.published").value(false));
        assertThat(artistProfiles.findPublishedByOwner(ARTIST)).isEmpty();
    }

    @Test
    void anyoneWithTheLinkSeesAPublishedProfileWithoutPrivateData() throws Exception {
        locationService.setForUser(ARTIST, new GeoPoint(50.06, 19.94), LocationSource.MANUAL,
                Locale.forLanguageTag("pl"));
        save(ARTIST, """
                {"stageName": "Weronika", "firstName": "Weronika", "lastName": "Tajna", "genres": ["TECHNO"],
                 "links": {"instagram": "https://instagram.com/weronika"}, "avatarMediaId": "%s"}
                """.formatted(image(ARTIST))).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/public/artists/{slug}", "weronika"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("ARTIST_PROFILE_NOT_FOUND"));

        as(ARTIST, post("/api/v1/artists/me/publish")).andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/public/artists/{slug}", "weronika"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stageName").value("Weronika"))
                .andExpect(jsonPath("$.links.instagram").value("https://instagram.com/weronika"))
                .andExpect(jsonPath("$.location.city").value("Kraków"))
                .andExpect(jsonPath("$.avatar.small").isNotEmpty())
                .andExpect(jsonPath("$.firstName").doesNotExist())
                .andExpect(jsonPath("$.lastName").doesNotExist())
                .andExpect(content().string(not(containsString("Tajna"))))
                .andExpect(content().string(not(containsString("latitude"))))
                .andExpect(content().string(not(containsString(ARTIST.toString()))));
        mockMvc.perform(get("/api/v1/public/artists/{slug}", "nobody")).andExpect(status().isNotFound());
    }

    @Test
    void listsGenres() throws Exception {
        as(ARTIST, get("/api/v1/artists/genres"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0]").value("TECHNO"))
                .andExpect(jsonPath("$[?(@ == 'OPEN_FORMAT')]").exists());
    }

    private void makePublishable(UUID artist) throws Exception {
        locationService.setForUser(artist, new GeoPoint(50.06, 19.94), LocationSource.MANUAL,
                Locale.forLanguageTag("pl"));
        var avatar = image(artist);
        var current = jdbc.queryForMap("SELECT stage_name FROM artist_profile WHERE owner_id = ?", artist);
        save(artist, "{\"stageName\": \"%s\", \"genres\": [\"TECHNO\"], \"avatarMediaId\": \"%s\"}"
                .formatted(current.get("stage_name"), avatar)).andExpect(status().isOk());
    }

    /** A processed image row; the facade reads only the database. */
    private UUID image(UUID owner) {
        var id = UUID.randomUUID();
        var now = java.sql.Timestamp.from(Instant.now());
        jdbc.update("INSERT INTO media (id, created_at, updated_at, version, owner_id, width, height, small_key,"
                + " medium_key, large_key) VALUES (?, ?, ?, 0, ?, 1600, 900, ?, ?, ?)", id, now, now, owner,
                "media/" + id + "/small.webp", "media/" + id + "/medium.webp", "media/" + id + "/large.webp");
        return id;
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

    private ResultActions save(UUID user, String body) throws Exception {
        return save(user, "ARTIST", body);
    }

    private ResultActions save(UUID user, String role, String body) throws Exception {
        return as(user, role, put("/api/v1/artists/me").contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private ResultActions as(UUID user, MockHttpServletRequestBuilder request) throws Exception {
        return as(user, "ARTIST", request);
    }

    private ResultActions as(UUID user, String role, MockHttpServletRequestBuilder request) throws Exception {
        return mockMvc.perform(request.with(jwt().jwt(token -> token.subject(user.toString()))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role))));
    }
}
