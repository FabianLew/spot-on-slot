package pl.spotonslot.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.sql.Timestamp;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
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
import pl.spotonslot.booking.application.BookingService;
import pl.spotonslot.support.IntegrationTest;

@IntegrationTest
@RecordApplicationEvents
class BookingIntegrationTest {

    private static final ZoneId WARSAW = ZoneId.of("Europe/Warsaw");
    private static final UUID ARTIST = UUID.fromString("0190a5d2-0000-7000-8000-0000000000f1");
    private static final UUID DRAFT_ARTIST = UUID.fromString("0190a5d2-0000-7000-8000-0000000000f2");
    private static final UUID OWNER = UUID.fromString("0190a5d2-0000-7000-8000-0000000000f3");
    private static final UUID MANAGER = UUID.fromString("0190a5d2-0000-7000-8000-0000000000f4");
    private static final UUID OTHER_OWNER = UUID.fromString("0190a5d2-0000-7000-8000-0000000000f5");
    private static final UUID OUTSIDER = UUID.fromString("0190a5d2-0000-7000-8000-0000000000f6");
    private static final UUID VENUE = UUID.fromString("0190a5d2-0000-7000-8000-0000000000a1");
    private static final UUID OTHER_VENUE = UUID.fromString("0190a5d2-0000-7000-8000-0000000000a2");
    private static final UUID DRAFT_VENUE = UUID.fromString("0190a5d2-0000-7000-8000-0000000000a3");

    /** A Monday at least a week ahead, so every test date is in the future. */
    private static final LocalDate MONDAY = LocalDate.now(WARSAW).plusWeeks(1).with(
            TemporalAdjusters.next(DayOfWeek.MONDAY));

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    BookingService bookingService;

    @Autowired
    Bookings bookings;

    @Autowired
    ApplicationEvents events;

    private String slug;

    @BeforeEach
    void clean() throws Exception {
        jdbc.update("DELETE FROM booking");
        jdbc.update("DELETE FROM listing");
        jdbc.update("DELETE FROM availability_slot");
        jdbc.update("DELETE FROM availability_rule");
        jdbc.update("DELETE FROM artist_profile");
        jdbc.update("DELETE FROM location WHERE subject_id IN (?, ?)", ARTIST, DRAFT_ARTIST);
        jdbc.update("DELETE FROM venue");
        for (var artist : List.of(ARTIST, DRAFT_ARTIST)) {
            as(artist, "ARTIST", put("/api/v1/artists/me").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"stageName\": \"DJ " + artist.toString().substring(34) + "\"}"))
                    .andExpect(status().isOk());
            var now = Timestamp.from(Instant.now());
            jdbc.update("INSERT INTO location (id, created_at, updated_at, version, subject_type, subject_id, source,"
                    + " precision, label, city, latitude, longitude) VALUES (?, ?, ?, 0, 'USER', ?, 'MANUAL',"
                    + " 'APPROXIMATE', 'Kraków', 'Kraków', 50.06, 19.94)", UUID.randomUUID(), now, now, artist);
        }
        jdbc.update("UPDATE artist_profile SET published_at = now() WHERE owner_id = ?", ARTIST);
        slug = jdbc.queryForObject("SELECT slug FROM artist_profile WHERE owner_id = ?", String.class, ARTIST);
        venue(VENUE, "pod-ziemia", "Pod Ziemią", true);
        venue(OTHER_VENUE, "piwnica", "Piwnica", true);
        venue(DRAFT_VENUE, "szkic", "Szkic", false);
        member(VENUE, OWNER, "OWNER");
        member(VENUE, MANAGER, "MANAGER");
        member(OTHER_VENUE, OTHER_OWNER, "OWNER");
        member(DRAFT_VENUE, OWNER, "OWNER");
    }

    @Test
    void venueRequestsArtistNegotiatesAndBooks() throws Exception {
        var slot = addSlot(at(4, "21:00"), at(5, "04:00"));

        var id = id(request(OWNER, VENUE, at(4, "22:00"), at(5, "02:00"), 100000, "Zagrasz u nas?")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.awaiting").value("ARTIST"))
                .andExpect(jsonPath("$.myParty").value("VENUE"))
                .andExpect(jsonPath("$.myTurn").value(false))
                .andExpect(jsonPath("$.revision").value(1))
                .andExpect(jsonPath("$.amount").value(100000))
                .andExpect(jsonPath("$.artist.stageName").value("DJ f1"))
                .andExpect(jsonPath("$.artist.slug").value(slug))
                .andExpect(jsonPath("$.venue.name").value("Pod Ziemią"))
                .andExpect(jsonPath("$.respondBy").isNotEmpty()));
        assertThat(events.stream(BookingRequested.class)).singleElement().satisfies(event -> {
            assertThat(event.bookingId()).hasToString(id);
            assertThat(event.artistId()).isEqualTo(ARTIST);
            assertThat(event.venueId()).isEqualTo(VENUE);
            assertThat(event.by()).isEqualTo(BookingParty.VENUE);
        });

        // Both sides see it; the whole venue team does; nobody else.
        as(ARTIST, "ARTIST", get("/api/v1/bookings").param("awaitingMe", "true"))
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].myTurn").value(true));
        as(MANAGER, "VENUE", get("/api/v1/bookings/" + id)).andExpect(status().isOk());
        as(OTHER_OWNER, "VENUE", get("/api/v1/bookings/" + id))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("BOOKING_NOT_FOUND"));
        as(OWNER, "VENUE", get("/api/v1/bookings").param("awaitingMe", "true"))
                .andExpect(jsonPath("$.content").isEmpty());

        // Only the side whose turn it is acts.
        as(OWNER, "VENUE", post("/api/v1/bookings/" + id + "/accept").contentType(MediaType.APPLICATION_JSON)
                .content("{\"revision\": 1}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BOOKING_NOT_YOUR_TURN"));
        counter(ARTIST, "ARTIST", id, at(4, "22:00"), at(5, "02:00"), 150000, "Za 1500 zł chętnie")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.awaiting").value("VENUE"))
                .andExpect(jsonPath("$.revision").value(2));
        assertThat(events.stream(BookingCountered.class)).hasSize(1);

        // Accepting an older offer fails; the current one books the time.
        accept(MANAGER, "VENUE", id, 1)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BOOKING_STALE"));
        accept(MANAGER, "VENUE", id, 2)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACCEPTED"))
                .andExpect(jsonPath("$.awaiting").doesNotExist())
                .andExpect(jsonPath("$.amount").value(150000))
                .andExpect(jsonPath("$.steps", hasSize(3)))
                .andExpect(jsonPath("$.steps[0].type").value("REQUESTED"))
                .andExpect(jsonPath("$.steps[0].party").value("VENUE"))
                .andExpect(jsonPath("$.steps[0].mine").value(true))
                .andExpect(jsonPath("$.steps[0].message").value("Zagrasz u nas?"))
                .andExpect(jsonPath("$.steps[1].type").value("COUNTERED"))
                .andExpect(jsonPath("$.steps[1].amount").value(150000))
                .andExpect(jsonPath("$.steps[2].type").value("ACCEPTED"));
        assertThat(jdbc.queryForObject("SELECT status FROM availability_slot WHERE id = ?::uuid", String.class, slot))
                .isEqualTo("BOOKED");
        assertThat(jdbc.queryForObject("SELECT booking_id FROM availability_slot WHERE id = ?::uuid", UUID.class,
                slot)).hasToString(id);
        // The artist's own calendar links the booked time to its booking.
        as(ARTIST, "ARTIST", get("/api/v1/availability/me").param("from", at(4, "00:00").toString())
                .param("to", at(6, "00:00").toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].status").value("BOOKED"))
                .andExpect(jsonPath("$[0].bookingId").value(id));
        assertThat(events.stream(BookingAccepted.class)).singleElement()
                .satisfies(event -> assertThat(event.by()).isEqualTo(BookingParty.VENUE));
        assertThat(bookings.venueHasAcceptedBetween(VENUE, at(4, "23:00"), at(5, "01:00"))).isTrue();
        assertThat(bookings.venueHasAcceptedBetween(VENUE, at(5, "02:00"), at(5, "05:00"))).isFalse();
        assertThat(bookings.venueHasAcceptedBetween(OTHER_VENUE, at(4, "23:00"), at(5, "01:00"))).isFalse();
    }

    @Test
    void requestsNeedFreeTimePublishedSidesAndNoDuplicates() throws Exception {
        request(OWNER, VENUE, at(4, "22:00"), at(5, "02:00"), 0, null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BOOKING_NOT_FREE"));

        addSlot(at(4, "21:00"), at(5, "04:00"));
        request(OWNER, VENUE, at(4, "22:00"), at(5, "02:00"), 0, null).andExpect(status().isCreated());
        request(MANAGER, VENUE, at(4, "23:00"), at(5, "01:00"), 0, null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BOOKING_DUPLICATE"));
        // Another venue may ask for the same evening: only acceptance holds the time.
        request(OTHER_OWNER, OTHER_VENUE, at(4, "22:00"), at(5, "02:00"), 0, null).andExpect(status().isCreated());

        request(OWNER, DRAFT_VENUE, at(4, "22:00"), at(5, "02:00"), 0, null)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("BOOKING_VENUE_NOT_PUBLISHED"));
        request(OUTSIDER, VENUE, at(4, "22:00"), at(5, "02:00"), 0, null)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("BOOKING_VENUE_NOT_FOUND"));
        var draftSlug = jdbc.queryForObject("SELECT slug FROM artist_profile WHERE owner_id = ?", String.class,
                DRAFT_ARTIST);
        as(OWNER, "VENUE", post("/api/v1/bookings").contentType(MediaType.APPLICATION_JSON)
                .content(requestBody(VENUE, "\"artistSlug\": \"" + draftSlug + "\"", at(4, "22:00"), at(5, "02:00"),
                        0, null)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("BOOKING_ARTIST_NOT_FOUND"));
        request(OWNER, VENUE, at(4, "22:00"), at(4, "22:15"), 0, null)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BOOKING_DURATION_INVALID"));
        request(OWNER, VENUE, at(4, "22:00"), at(5, "02:00"), -1, null).andExpect(status().isBadRequest());
    }

    @Test
    void artistsApplyToVenueListingsWithoutMarkingTheTimeFree() throws Exception {
        var listing = seek(OWNER, VENUE, at(5, "20:00"), at(6, "02:00"));

        var id = id(apply(ARTIST, listing, 120000, "Chętnie zagram")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.awaiting").value("VENUE"))
                .andExpect(jsonPath("$.myParty").value("ARTIST"))
                .andExpect(jsonPath("$.listingId").value(listing))
                .andExpect(jsonPath("$.startsAt").value(at(5, "20:00").toString())));
        apply(ARTIST, listing, 100000, null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BOOKING_DUPLICATE"));

        accept(OWNER, "VENUE", id, 1).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ACCEPTED"));
        assertThat(jdbc.queryForObject("SELECT status FROM availability_slot WHERE booking_id = ?::uuid",
                String.class, id)).isEqualTo("BOOKED");
        assertThat(jdbc.queryForObject("SELECT status FROM listing WHERE id = ?::uuid", String.class, listing))
                .isEqualTo("FILLED");
        as(OWNER, "VENUE", get("/api/v1/venues/" + VENUE + "/listings"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].status").value("FILLED"))
                .andExpect(jsonPath("$.content[0].bookingId").value(id));

        // Booked time cannot be offered again.
        var another = seek(OTHER_OWNER, OTHER_VENUE, at(5, "22:00"), at(6, "03:00"));
        apply(ARTIST, another, 0, null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BOOKING_NOT_FREE"));
        // Artists only apply to "looking for an artist" listings.
        as(ARTIST, "ARTIST", post("/api/v1/bookings").contentType(MediaType.APPLICATION_JSON)
                .content("{\"amount\": 0}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BOOKING_REQUEST_INVALID"));
    }

    @Test
    void acceptanceDeclinesCompetingRequestsAndChecksTheCalendar() throws Exception {
        addSlot(at(4, "21:00"), at(5, "04:00"));
        var first = id(request(OWNER, VENUE, at(4, "22:00"), at(5, "02:00"), 100000, null));
        var second = id(request(OTHER_OWNER, OTHER_VENUE, at(4, "23:00"), at(5, "03:00"), 200000, null));

        accept(ARTIST, "ARTIST", second, 1).andExpect(status().isOk());
        as(OWNER, "VENUE", get("/api/v1/bookings/" + first))
                .andExpect(jsonPath("$.status").value("DECLINED"))
                .andExpect(jsonPath("$.steps[1].type").value("DECLINED"))
                .andExpect(jsonPath("$.steps[1].party").value("SYSTEM"));
        assertThat(events.stream(BookingDeclined.class)).singleElement()
                .satisfies(event -> assertThat(event.by()).isEqualTo(BookingParty.SYSTEM));

        // Free time that only partly covers the gig is a conflict the artist must fix in the calendar first.
        addSlot(at(6, "22:00"), at(7, "04:00"));
        var listing = seek(OWNER, VENUE, at(6, "20:00"), at(6, "23:00"));
        var partial = id(apply(ARTIST, listing, 0, null).andExpect(status().isCreated()));
        accept(OWNER, "VENUE", partial, 1)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BOOKING_CALENDAR_CONFLICT"));
    }

    @Test
    void declineWithdrawAndCancel() throws Exception {
        addSlot(at(4, "21:00"), at(5, "04:00"));
        addSlot(at(5, "21:00"), at(6, "04:00"));
        var declined = id(request(OWNER, VENUE, at(4, "22:00"), at(5, "02:00"), 0, null));
        as(ARTIST, "ARTIST", post("/api/v1/bookings/" + declined + "/decline")
                .contentType(MediaType.APPLICATION_JSON).content("{\"reason\": \"Gram wtedy gdzie indziej\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DECLINED"))
                .andExpect(jsonPath("$.steps[1].message").value("Gram wtedy gdzie indziej"));
        counter(ARTIST, "ARTIST", declined, at(4, "22:00"), at(5, "02:00"), 1, null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BOOKING_CLOSED"));

        var withdrawn = id(request(OWNER, VENUE, at(4, "22:00"), at(5, "02:00"), 0, null));
        as(ARTIST, "ARTIST", post("/api/v1/bookings/" + withdrawn + "/withdraw"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BOOKING_NOT_YOUR_TURN"));
        as(MANAGER, "VENUE", post("/api/v1/bookings/" + withdrawn + "/withdraw"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("WITHDRAWN"));
        assertThat(events.stream(BookingWithdrawn.class)).hasSize(1);

        var booked = id(request(OWNER, VENUE, at(5, "22:00"), at(6, "02:00"), 50000, null));
        accept(ARTIST, "ARTIST", booked, 1).andExpect(status().isOk());
        as(ARTIST, "ARTIST", post("/api/v1/bookings/" + booked + "/cancel").contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isBadRequest());
        as(ARTIST, "ARTIST", post("/api/v1/bookings/" + booked + "/cancel").contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\": \"Choroba\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.steps[2].type").value("CANCELLED"))
                .andExpect(jsonPath("$.steps[2].message").value("Choroba"));
        assertThat(jdbc.queryForObject("SELECT status FROM availability_slot WHERE starts_at = ?", String.class,
                Timestamp.from(at(5, "21:00")))).isEqualTo("FREE");
        assertThat(events.stream(BookingCancelled.class)).singleElement()
                .satisfies(event -> assertThat(event.by()).isEqualTo(BookingParty.ARTIST));

        // Several statuses at once (the "Historia" filter), newest first.
        as(OWNER, "VENUE", get("/api/v1/bookings").param("status", "DECLINED", "CANCELLED")
                .param("sort", "startsAt,desc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].id").value(booked))
                .andExpect(jsonPath("$.content[1].id").value(declined));
    }

    @Test
    void unansweredRequestsExpireAndPlayedBookingsComplete() throws Exception {
        addSlot(at(4, "21:00"), at(5, "04:00"));
        addSlot(at(5, "21:00"), at(6, "04:00"));
        var pending = id(request(OWNER, VENUE, at(4, "22:00"), at(5, "02:00"), 0, null));
        var accepted = id(request(OWNER, VENUE, at(5, "22:00"), at(6, "02:00"), 0, null));
        accept(ARTIST, "ARTIST", accepted, 1).andExpect(status().isOk());

        jdbc.update("UPDATE booking SET respond_by = now() - interval '1 minute' WHERE id = ?::uuid", pending);
        jdbc.update("UPDATE booking SET starts_at = now() - interval '3 hours', ends_at = now() - interval '1 hour'"
                + " WHERE id = ?::uuid", accepted);

        // Reads show the new status before the job stores it.
        as(OWNER, "VENUE", get("/api/v1/bookings/" + pending)).andExpect(jsonPath("$.status").value("EXPIRED"));
        as(OWNER, "VENUE", get("/api/v1/bookings").param("status", "COMPLETED"))
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].id").value(accepted));
        accept(ARTIST, "ARTIST", pending, 1)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BOOKING_CLOSED"));

        assertThat(bookingService.storeTimedOut()).isEqualTo(2);
        assertThat(jdbc.queryForList("SELECT status FROM booking ORDER BY starts_at", String.class))
                .containsExactly("COMPLETED", "EXPIRED");
        as(OWNER, "VENUE", get("/api/v1/bookings/" + pending))
                .andExpect(jsonPath("$.steps[1].type").value("EXPIRED"))
                .andExpect(jsonPath("$.steps[1].party").value("SYSTEM"));
        assertThat(events.stream(BookingExpired.class)).hasSize(1);
    }

    @Test
    void simultaneousAcceptancesBookTheEveningOnce() throws Exception {
        addSlot(at(4, "21:00"), at(5, "04:00"));
        var first = id(request(OWNER, VENUE, at(4, "22:00"), at(5, "02:00"), 0, null));
        var second = id(request(OTHER_OWNER, OTHER_VENUE, at(4, "22:00"), at(5, "02:00"), 0, null));

        var executor = Executors.newFixedThreadPool(2);
        try {
            var tasks = new ArrayList<Callable<Integer>>();
            for (var id : List.of(first, second)) {
                tasks.add(() -> accept(ARTIST, "ARTIST", id, 1).andReturn().getResponse().getStatus());
            }
            var codes = new ArrayList<Integer>();
            for (var future : executor.invokeAll(tasks)) {
                codes.add(future.get());
            }
            assertThat(codes).containsExactlyInAnyOrder(200, 409);
        } finally {
            executor.shutdown();
        }
        assertThat(jdbc.queryForList("SELECT status FROM booking", String.class))
                .containsExactlyInAnyOrder("ACCEPTED", "DECLINED");
    }

    private Instant at(int daysAfterMonday, String time) {
        return MONDAY.plusDays(daysAfterMonday).atTime(LocalTime.parse(time)).atZone(WARSAW).toInstant();
    }

    private String addSlot(Instant startsAt, Instant endsAt) throws Exception {
        return id(as(ARTIST, "ARTIST", post("/api/v1/availability/me/slots").contentType(MediaType.APPLICATION_JSON)
                .content("{\"startsAt\": \"" + startsAt + "\", \"endsAt\": \"" + endsAt + "\"}"))
                .andExpect(status().isCreated()));
    }

    private String seek(UUID user, UUID venue, Instant startsAt, Instant endsAt) throws Exception {
        return id(as(user, "VENUE", post("/api/v1/venues/" + venue + "/listings")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"startsAt\": \"" + startsAt + "\", \"endsAt\": \"" + endsAt
                        + "\", \"genres\": [\"TECHNO\"]}"))
                .andExpect(status().isCreated()));
    }

    private static String requestBody(UUID venue, String target, Instant startsAt, Instant endsAt, long amount,
            String message) {
        return "{\"venueId\": \"" + venue + "\", " + target + ", \"startsAt\": \"" + startsAt + "\", \"endsAt\": \""
                + endsAt + "\", \"amount\": " + amount + (message == null ? "" : ", \"message\": \"" + message + "\"")
                + "}";
    }

    private ResultActions request(UUID user, UUID venue, Instant startsAt, Instant endsAt, long amount,
            String message) throws Exception {
        return as(user, "VENUE", post("/api/v1/bookings").contentType(MediaType.APPLICATION_JSON)
                .content(requestBody(venue, "\"artistSlug\": \"" + slug + "\"", startsAt, endsAt, amount, message)));
    }

    private ResultActions apply(UUID artist, String listing, long amount, String message) throws Exception {
        return as(artist, "ARTIST", post("/api/v1/bookings").contentType(MediaType.APPLICATION_JSON)
                .content("{\"listingId\": \"" + listing + "\", \"amount\": " + amount
                        + (message == null ? "" : ", \"message\": \"" + message + "\"") + "}"));
    }

    private ResultActions counter(UUID user, String role, String id, Instant startsAt, Instant endsAt, long amount,
            String message) throws Exception {
        return as(user, role, post("/api/v1/bookings/" + id + "/counter").contentType(MediaType.APPLICATION_JSON)
                .content("{\"startsAt\": \"" + startsAt + "\", \"endsAt\": \"" + endsAt + "\", \"amount\": " + amount
                        + (message == null ? "" : ", \"message\": \"" + message + "\"") + "}"));
    }

    private ResultActions accept(UUID user, String role, String id, int revision) throws Exception {
        return as(user, role, post("/api/v1/bookings/" + id + "/accept").contentType(MediaType.APPLICATION_JSON)
                .content("{\"revision\": " + revision + "}"));
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
}
