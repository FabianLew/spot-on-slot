package pl.spotonslot.venue;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import java.util.function.BooleanSupplier;
import org.junit.jupiter.api.AfterEach;
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
import pl.spotonslot.location.GeoPoint;
import pl.spotonslot.media.application.MediaService;
import pl.spotonslot.support.IntegrationTest;
import pl.spotonslot.support.PhotonStub;

@IntegrationTest
@RecordApplicationEvents
class VenueIntegrationTest {

    private static final UUID OWNER = UUID.fromString("0190a5d2-0000-7000-8000-0000000000c1");
    private static final UUID MANAGER = UUID.fromString("0190a5d2-0000-7000-8000-0000000000c2");
    private static final UUID OUTSIDER = UUID.fromString("0190a5d2-0000-7000-8000-0000000000c3");
    private static final UUID ARTIST = UUID.fromString("0190a5d2-0000-7000-8000-0000000000c4");
    private static final String MINIMAL = "{\"name\": \"Pod Ziemią\", \"type\": \"CLUB\"}";

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    PhotonStub photon;

    @Autowired
    MediaService mediaService;

    @Autowired
    Venues venues;

    @Autowired
    ApplicationEvents events;

    @BeforeEach
    void clean() {
        jdbc.update("DELETE FROM venue");
        jdbc.update("DELETE FROM media");
        jdbc.update("DELETE FROM identity_user WHERE id IN (?, ?, ?, ?) OR email LIKE 'venue-%@example.com'",
                OWNER, MANAGER, OUTSIDER, ARTIST);
        account(OWNER, "venue-owner@example.com", "VENUE");
        account(MANAGER, "venue-manager@example.com", "VENUE");
        account(OUTSIDER, "venue-outsider@example.com", "VENUE");
        account(ARTIST, "venue-artist@example.com", "ARTIST");
    }

    @AfterEach
    void resetPhoton() {
        photon.reset();
    }

    @Test
    void createsADraftVenueWithItsCreatorAsOwnerAndGeocodesTheAddress() throws Exception {
        create(OWNER, """
                {"name": " Klub Pod Ziemią ", "type": "CLUB", "description": "Piwnica na Kazimierzu", "capacity": 350,
                 "address": {"street": "Rynek Główny 1", "postalCode": "31-042", "city": "Kraków"},
                 "genres": ["HOUSE", "TECHNO", "HOUSE"], "tags": ["piwnica", " Piwnica ", "funktion-one"],
                 "links": {"website": "https://podziemia.pl", "facebook": "https://www.facebook.com/podziemia"}}
                """)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.slug").value("klub-pod-ziemia"))
                .andExpect(jsonPath("$.name").value("Klub Pod Ziemią"))
                .andExpect(jsonPath("$.role").value("OWNER"))
                .andExpect(jsonPath("$.capacity").value(350))
                .andExpect(jsonPath("$.address.city").value("Kraków"))
                .andExpect(jsonPath("$.address.latitude").value(50.0617))
                .andExpect(jsonPath("$.address.longitude").value(19.9372))
                .andExpect(jsonPath("$.genres", contains("TECHNO", "HOUSE")))
                .andExpect(jsonPath("$.tags", contains("piwnica", "funktion-one")))
                .andExpect(jsonPath("$.links.website").value("https://podziemia.pl"))
                .andExpect(jsonPath("$.links.instagram").doesNotExist())
                .andExpect(jsonPath("$.published").value(false))
                .andExpect(jsonPath("$.missingForPublication", contains("AVATAR")));
        assertThat(photon.requests().getLast().getQuery()).contains("q=Rynek Główny 1, 31-042 Kraków");

        as(OWNER, get("/api/v1/venues/mine"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].name", contains("Klub Pod Ziemią")))
                .andExpect(jsonPath("$[0].role").value("OWNER"));
        assertThat(venues.findManagedBy(OWNER)).extracting(VenueMembership::role).containsExactly(VenueRole.OWNER);
    }

    @Test
    void aPickedPointWinsAndAnUnchangedAddressIsNotGeocodedAgain() throws Exception {
        var id = idOf(create(OWNER, """
                {"name": "Pod Ziemią", "type": "BAR",
                 "address": {"street": "Szewska 5", "city": "Kraków", "latitude": 50.0625, "longitude": 19.9351}}
                """).andExpect(jsonPath("$.address.latitude").value(50.0625)));
        assertThat(photon.requests()).isEmpty();

        save(OWNER, id, """
                {"name": "Pod Ziemią 2", "type": "BAR", "address": {"street": "Szewska 5", "city": "Kraków"}}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.address.latitude").value(50.0625))
                .andExpect(jsonPath("$.address.longitude").value(19.9351));
        assertThat(photon.requests()).isEmpty();
    }

    @Test
    void anAddressTheGeocoderCannotFindIsSavedWithoutAPoint() throws Exception {
        photon.respondWith(200, "{\"type\": \"FeatureCollection\", \"features\": []}");

        create(OWNER, """
                {"name": "Pod Ziemią", "type": "CLUB", "address": {"street": "Nieznana 999", "city": "Kraków"},
                 "genres": ["TECHNO"]}
                """)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.address.street").value("Nieznana 999"))
                .andExpect(jsonPath("$.address.latitude").doesNotExist())
                .andExpect(jsonPath("$.missingForPublication", contains("ADDRESS", "AVATAR")));
    }

    @Test
    void aGeocoderOutageIsServiceUnavailableAndSavesNothing() throws Exception {
        photon.respondWith(502, "bad gateway");

        create(OWNER, """
                {"name": "Pod Ziemią", "type": "CLUB", "address": {"street": "Szewska 5", "city": "Kraków"}}
                """)
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("LOCATION_GEOCODER_UNAVAILABLE"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM venue", Long.class)).isZero();
    }

    @Test
    void numbersTheAddressWhenTheNameIsTakenAndChecksRequestedOnes() throws Exception {
        var first = idOf(create(OWNER, MINIMAL).andExpect(jsonPath("$.slug").value("pod-ziemia")));
        create(OUTSIDER, MINIMAL).andExpect(jsonPath("$.slug").value("pod-ziemia-2"));

        as(OWNER, get("/api/v1/venues/slugs/{slug}", "pod-ziemia-2"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VENUE_SLUG_TAKEN"));
        as(OWNER, get("/api/v1/venues/slugs/{slug}", "pod-ziemia")).andExpect(status().isConflict());
        as(OWNER, get("/api/v1/venues/slugs/{slug}", "pod-ziemia").param("venueId", first.toString()))
                .andExpect(status().isNoContent());
        as(OWNER, get("/api/v1/venues/slugs/{slug}", "settings"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VENUE_SLUG_RESERVED"));

        save(OWNER, first, "{\"name\": \"Pod Ziemią\", \"type\": \"CLUB\", \"slug\": \"pod-ziemia-2\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VENUE_SLUG_TAKEN"));
        save(OWNER, first, "{\"name\": \"Pod Ziemią\", \"type\": \"CLUB\", \"slug\": \"podziemie\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slug").value("podziemie"));
        save(OWNER, first, "{\"name\": \"Inna nazwa\", \"type\": \"PUB\"}")
                .andExpect(jsonPath("$.slug").value("podziemie"))
                .andExpect(jsonPath("$.type").value("PUB"));
    }

    @Test
    void rejectsInvalidFields() throws Exception {
        create(OWNER, """
                {"name": "", "type": null, "capacity": 0, "slug": "Zły", "address": {"street": "", "city": "Kraków"},
                 "genres": ["TECHNO", "HOUSE", "TRANCE", "DISCO", "FUNK", "POP"], "tags": ["%s"],
                 "links": {"website": "http://podziemia.pl", "instagram": "https://evil.com/x",
                           "facebook": "https://instagram.com/x"}}
                """.formatted("x".repeat(31)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors[*].field", hasItems("name", "type", "capacity", "slug",
                        "address.street", "genres", "tags[0]", "links.website", "links.instagram",
                        "links.facebook")));
        create(OWNER, "{\"name\": \"X\", \"type\": \"CLUB\", \"capacity\": 100001}")
                .andExpect(status().isBadRequest());
    }

    @Test
    void onlyVenueAccountsManageVenues() throws Exception {
        create(ARTIST, "ARTIST", MINIMAL).andExpect(status().isForbidden());
        as(ARTIST, "ARTIST", get("/api/v1/venues/mine")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/venues/mine")).andExpect(status().isUnauthorized());
        as(ARTIST, "ARTIST", get("/api/v1/venues/types"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0]").value("CLUB"));
    }

    @Test
    void aVenueOutsideYourTeamsDoesNotExist() throws Exception {
        var id = idOf(create(OWNER, MINIMAL));

        as(OUTSIDER, get("/api/v1/venues/{id}", id))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("VENUE_NOT_FOUND"));
        save(OUTSIDER, id, MINIMAL).andExpect(status().isNotFound());
        as(OUTSIDER, post("/api/v1/venues/{id}/publish", id)).andExpect(status().isNotFound());
        as(OUTSIDER, delete("/api/v1/venues/{id}", id)).andExpect(status().isNotFound());
        as(OUTSIDER, get("/api/v1/venues/{id}/team", id)).andExpect(status().isNotFound());
        as(OWNER, get("/api/v1/venues/{id}", UUID.randomUUID())).andExpect(status().isNotFound());
    }

    @Test
    void onePersonCanBeInAtMostTenVenueTeams() throws Exception {
        for (var i = 0; i < 10; i++) {
            create(OWNER, MINIMAL).andExpect(status().isCreated());
        }
        create(OWNER, MINIMAL)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VENUE_LIMIT_REACHED"));
        as(OWNER, get("/api/v1/venues/mine")).andExpect(jsonPath("$.length()").value(10));
    }

    @Test
    void photosAddedMustBelongToThePersonSavingWhileExistingOnesStay() throws Exception {
        var id = idOf(create(OWNER, MINIMAL));
        join(id, MANAGER, "venue-manager@example.com", "MANAGER");
        var ownersPhoto = image(OWNER);
        var managersPhoto = image(MANAGER);

        save(OWNER, id, photos(ownersPhoto)).andExpect(status().isOk());
        save(MANAGER, id, photos(ownersPhoto, managersPhoto))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("MANAGER"))
                .andExpect(jsonPath("$.photos[*].id", contains(ownersPhoto.toString(), managersPhoto.toString())));
        save(MANAGER, id, photos(ownersPhoto, managersPhoto, image(OUTSIDER)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VENUE_MEDIA_NOT_OWNED"));
        save(OWNER, id, "{\"name\": \"X\", \"type\": \"CLUB\", \"avatarMediaId\": \"%s\"}"
                .formatted(UUID.randomUUID()))
                .andExpect(jsonPath("$.code").value("VENUE_MEDIA_NOT_OWNED"));
    }

    @Test
    void deletingAPhotoRemovesItFromTheVenue() throws Exception {
        var avatar = image(OWNER);
        var photo = image(OWNER);
        var id = idOf(create(OWNER, """
                {"name": "Pod Ziemią", "type": "CLUB", "avatarMediaId": "%s", "photoMediaIds": ["%s", "%s"]}
                """.formatted(avatar, photo, avatar)));

        mediaService.delete(OWNER, avatar);

        await(() -> jdbc.queryForObject("SELECT count(*) FROM venue_photo", Long.class) == 1
                && jdbc.queryForObject("SELECT count(*) FROM venue WHERE avatar_media_id IS NULL", Long.class) == 1);
        as(OWNER, get("/api/v1/venues/{id}", id))
                .andExpect(jsonPath("$.avatar").doesNotExist())
                .andExpect(jsonPath("$.photos[*].id", contains(photo.toString())));
    }

    @Test
    void publishesOnlyACompleteVenueAndOnlyOwnersPublish() throws Exception {
        var id = idOf(create(OWNER, MINIMAL));
        join(id, MANAGER, "venue-manager@example.com", "MANAGER");
        as(OWNER, post("/api/v1/venues/{id}/publish", id))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VENUE_PROFILE_INCOMPLETE"));

        makePublishable(id);
        as(MANAGER, post("/api/v1/venues/{id}/publish", id))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("VENUE_FORBIDDEN"));
        as(OWNER, post("/api/v1/venues/{id}/publish", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.published").value(true))
                .andExpect(jsonPath("$.publishedAt").isNotEmpty())
                .andExpect(jsonPath("$.missingForPublication").isEmpty());
        assertThat(venues.findPublished(id)).contains(new VenueSummary(id, "pod-ziemia", "Pod Ziemią", "Kraków",
                new GeoPoint(50.0617, 19.9372)));

        as(OWNER, post("/api/v1/venues/{id}/unpublish", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.published").value(false));
        assertThat(venues.findPublished(id)).isEmpty();
    }

    @Test
    void anyoneWithTheLinkSeesAPublishedVenueWithoutItsTeam() throws Exception {
        var id = idOf(create(OWNER, MINIMAL));
        makePublishable(id);
        mockMvc.perform(get("/api/v1/public/venues/{slug}", "pod-ziemia"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("VENUE_NOT_FOUND"));

        as(OWNER, post("/api/v1/venues/{id}/publish", id)).andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/public/venues/{slug}", "pod-ziemia"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Pod Ziemią"))
                .andExpect(jsonPath("$.type").value("CLUB"))
                .andExpect(jsonPath("$.address.street").value("Rynek Główny 1"))
                .andExpect(jsonPath("$.address.latitude").value(50.0617))
                .andExpect(jsonPath("$.avatar.small").isNotEmpty())
                .andExpect(jsonPath("$.role").doesNotExist())
                .andExpect(content().string(not(containsString(OWNER.toString()))))
                .andExpect(content().string(not(containsString("venue-owner@example.com"))));
    }

    @Test
    void ownersDeleteVenuesManagersCannot() throws Exception {
        var id = idOf(create(OWNER, MINIMAL));
        join(id, MANAGER, "venue-manager@example.com", "MANAGER");

        as(MANAGER, delete("/api/v1/venues/{id}", id)).andExpect(status().isForbidden());
        as(OWNER, delete("/api/v1/venues/{id}", id)).andExpect(status().isNoContent());

        assertThat(jdbc.queryForObject("SELECT count(*) FROM venue_member", Long.class)).isZero();
        as(MANAGER, get("/api/v1/venues/mine")).andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void invitedPeopleJoinWithTheInvitedRole() throws Exception {
        var id = idOf(create(OWNER, MINIMAL));

        as(OWNER, post("/api/v1/venues/{id}/team/invitations", id).contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\": \"Venue-Manager@Example.com\", \"role\": \"MANAGER\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value("venue-manager@example.com"))
                .andExpect(jsonPath("$.expiresAt").isNotEmpty());
        var sent = events.stream(VenueInvitationSent.class).toList().getLast();
        assertThat(sent.email()).isEqualTo("venue-manager@example.com");
        assertThat(sent.venueName()).isEqualTo("Pod Ziemią");
        assertThat(sent.role()).isEqualTo(VenueRole.MANAGER);
        assertThat(sent.locale()).isEqualTo("pl");
        assertThat(jdbc.queryForObject("SELECT token_hash FROM venue_invitation", String.class))
                .isNotEqualTo(sent.token()).hasSize(64);

        as(OWNER, get("/api/v1/venues/{id}/team", id))
                .andExpect(jsonPath("$.members[*].email", contains("venue-owner@example.com")))
                .andExpect(jsonPath("$.invitations[*].email", contains("venue-manager@example.com")));

        accept(MANAGER, sent.token())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id.toString()))
                .andExpect(jsonPath("$.role").value("MANAGER"));

        as(MANAGER, get("/api/v1/venues/{id}/team", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.members[*].email", contains("venue-owner@example.com", "venue-manager@example.com")))
                .andExpect(jsonPath("$.members[*].role", contains("OWNER", "MANAGER")))
                .andExpect(jsonPath("$.invitations").isEmpty());
        accept(MANAGER, sent.token())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VENUE_INVITATION_INVALID"));
    }

    @Test
    void onlyTheInvitedVenueAccountCanAcceptAndOnlyBeforeItExpires() throws Exception {
        var id = idOf(create(OWNER, MINIMAL));
        var token = invite(id, "venue-manager@example.com", "MANAGER");

        accept(OUTSIDER, token).andExpect(jsonPath("$.code").value("VENUE_INVITATION_INVALID"));
        accept(ARTIST, "ARTIST", token).andExpect(status().isForbidden());
        accept(MANAGER, "not-a-token").andExpect(jsonPath("$.code").value("VENUE_INVITATION_INVALID"));

        jdbc.update("UPDATE venue_invitation SET expires_at = ?", Timestamp.from(Instant.now().minusSeconds(1)));
        accept(MANAGER, token).andExpect(jsonPath("$.code").value("VENUE_INVITATION_INVALID"));
        as(OWNER, get("/api/v1/venues/{id}/team", id)).andExpect(jsonPath("$.invitations").isEmpty());
    }

    @Test
    void invitingAgainReplacesThePendingInvitationAndMembersCannotBeInvited() throws Exception {
        var id = idOf(create(OWNER, MINIMAL));
        var first = invite(id, "venue-manager@example.com", "MANAGER");
        var second = invite(id, "venue-manager@example.com", "OWNER");

        accept(MANAGER, first).andExpect(jsonPath("$.code").value("VENUE_INVITATION_INVALID"));
        accept(MANAGER, second).andExpect(status().isOk()).andExpect(jsonPath("$.role").value("OWNER"));

        as(OWNER, post("/api/v1/venues/{id}/team/invitations", id).contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\": \"venue-manager@example.com\", \"role\": \"MANAGER\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VENUE_ALREADY_MEMBER"));
    }

    @Test
    void ownersManageTheTeamManagersOnlyLeave() throws Exception {
        var id = idOf(create(OWNER, MINIMAL));
        join(id, MANAGER, "venue-manager@example.com", "MANAGER");

        as(MANAGER, post("/api/v1/venues/{id}/team/invitations", id).contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\": \"x@example.com\", \"role\": \"MANAGER\"}"))
                .andExpect(status().isForbidden());
        as(MANAGER, delete("/api/v1/venues/{id}/team/{userId}", id, OWNER))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("VENUE_FORBIDDEN"));

        var token = invite(id, "venue-outsider@example.com", "MANAGER");
        var invitationId = jdbc.queryForObject("SELECT id FROM venue_invitation", UUID.class);
        as(OWNER, delete("/api/v1/venues/{id}/team/invitations/{invitationId}", id, invitationId))
                .andExpect(status().isNoContent());
        accept(OUTSIDER, token).andExpect(jsonPath("$.code").value("VENUE_INVITATION_INVALID"));

        as(MANAGER, delete("/api/v1/venues/{id}/team/{userId}", id, MANAGER)).andExpect(status().isNoContent());
        as(MANAGER, get("/api/v1/venues/{id}", id)).andExpect(status().isNotFound());
    }

    @Test
    void theLastOwnerCannotBeRemoved() throws Exception {
        var id = idOf(create(OWNER, MINIMAL));
        join(id, MANAGER, "venue-manager@example.com", "OWNER");

        as(OWNER, delete("/api/v1/venues/{id}/team/{userId}", id, MANAGER)).andExpect(status().isNoContent());
        as(OWNER, delete("/api/v1/venues/{id}/team/{userId}", id, OWNER))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VENUE_LAST_OWNER"));
        as(OWNER, get("/api/v1/venues/{id}/team", id))
                .andExpect(jsonPath("$.members[*].userId", containsInAnyOrder(OWNER.toString())));
    }

    private void makePublishable(UUID id) throws Exception {
        save(OWNER, id, """
                {"name": "Pod Ziemią", "type": "CLUB", "genres": ["TECHNO"], "avatarMediaId": "%s",
                 "address": {"street": "Rynek Główny 1", "postalCode": "31-042", "city": "Kraków"}}
                """.formatted(image(OWNER))).andExpect(status().isOk());
    }

    private void join(UUID venueId, UUID user, String email, String role) throws Exception {
        accept(user, invite(venueId, email, role)).andExpect(status().isOk());
    }

    private String invite(UUID venueId, String email, String role) throws Exception {
        as(OWNER, post("/api/v1/venues/{id}/team/invitations", venueId).contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\": \"%s\", \"role\": \"%s\"}".formatted(email, role)))
                .andExpect(status().isCreated());
        return events.stream(VenueInvitationSent.class).toList().getLast().token();
    }

    private ResultActions accept(UUID user, String token) throws Exception {
        return accept(user, "VENUE", token);
    }

    private ResultActions accept(UUID user, String role, String token) throws Exception {
        return as(user, role, post("/api/v1/venues/invitations/accept").contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\": \"%s\"}".formatted(token)));
    }

    private static String photos(UUID... ids) {
        var list = String.join("\", \"", java.util.Arrays.stream(ids).map(UUID::toString).toList());
        return "{\"name\": \"Pod Ziemią\", \"type\": \"CLUB\", \"photoMediaIds\": [\"%s\"]}".formatted(list);
    }

    private void account(UUID id, String email, String role) {
        var now = Timestamp.from(Instant.now());
        jdbc.update("INSERT INTO identity_user (id, created_at, updated_at, version, email, password_hash, role,"
                + " status, locale, privacy_notice_accepted_at, email_verified_at)"
                + " VALUES (?, ?, ?, 0, ?, 'x', ?, 'ACTIVE', 'pl', ?, ?)", id, now, now, email, role, now, now);
    }

    /** A processed image row; the facade reads only the database. */
    private UUID image(UUID owner) {
        var id = UUID.randomUUID();
        var now = Timestamp.from(Instant.now());
        jdbc.update("INSERT INTO media (id, created_at, updated_at, version, owner_id, width, height, small_key,"
                + " medium_key, large_key) VALUES (?, ?, ?, 0, ?, 1600, 900, ?, ?, ?)", id, now, now, owner,
                "media/" + id + "/small.webp", "media/" + id + "/medium.webp", "media/" + id + "/large.webp");
        return id;
    }

    private static UUID idOf(ResultActions result) throws Exception {
        return UUID.fromString(JsonPath.read(result.andReturn().getResponse().getContentAsString(), "$.id"));
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

    private ResultActions create(UUID user, String body) throws Exception {
        return create(user, "VENUE", body);
    }

    private ResultActions create(UUID user, String role, String body) throws Exception {
        return as(user, role, post("/api/v1/venues").contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private ResultActions save(UUID user, UUID id, String body) throws Exception {
        return as(user, put("/api/v1/venues/{id}", id).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private ResultActions as(UUID user, MockHttpServletRequestBuilder request) throws Exception {
        return as(user, "VENUE", request);
    }

    private ResultActions as(UUID user, String role, MockHttpServletRequestBuilder request) throws Exception {
        return mockMvc.perform(request.with(jwt().jwt(token -> token.subject(user.toString()))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role))));
    }
}
