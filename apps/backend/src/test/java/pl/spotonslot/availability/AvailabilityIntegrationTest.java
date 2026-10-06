package pl.spotonslot.availability;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Set;
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
import pl.spotonslot.shared.error.DomainException;
import pl.spotonslot.support.IntegrationTest;

@IntegrationTest
class AvailabilityIntegrationTest {

    private static final ZoneId WARSAW = ZoneId.of("Europe/Warsaw");
    private static final UUID ARTIST = UUID.fromString("0190a5d2-0000-7000-8000-0000000000c1");
    private static final UUID OTHER_ARTIST = UUID.fromString("0190a5d2-0000-7000-8000-0000000000c2");
    private static final UUID NO_PROFILE = UUID.fromString("0190a5d2-0000-7000-8000-0000000000c3");

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
    void clean() throws Exception {
        jdbc.update("DELETE FROM availability_slot");
        jdbc.update("DELETE FROM availability_rule");
        jdbc.update("DELETE FROM artist_profile");
        for (var artist : List.of(ARTIST, OTHER_ARTIST)) {
            as(artist, put("/api/v1/artists/me").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"stageName\": \"DJ " + artist.toString().substring(34) + "\"}"))
                    .andExpect(status().isOk());
        }
    }

    @Test
    void addsSlotsAcrossMidnightAndListsThemInTheCalendar() throws Exception {
        addSlot(ARTIST, at(5, "22:00"), at(6, "04:00"), "tylko Kraków")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("FREE"))
                .andExpect(jsonPath("$.note").value("tylko Kraków"));

        calendar(ARTIST, at(0, "00:00"), at(7, "00:00"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].startsAt").value(at(5, "22:00").toString()))
                .andExpect(jsonPath("$[0].endsAt").value(at(6, "04:00").toString()))
                .andExpect(jsonPath("$[0].source").value("SLOT"))
                .andExpect(jsonPath("$[0].note").value("tylko Kraków"));
        calendar(OTHER_ARTIST, at(0, "00:00"), at(7, "00:00")).andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void rejectsSlotsOfTheWrongLengthOrInThePast() throws Exception {
        addSlot(ARTIST, at(1, "20:00"), at(1, "20:15"), null)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("AVAILABILITY_DURATION_INVALID"));
        addSlot(ARTIST, at(1, "20:00"), at(2, "20:01"), null)
                .andExpect(jsonPath("$.code").value("AVAILABILITY_DURATION_INVALID"));
        addSlot(ARTIST, at(1, "20:00"), at(1, "19:00"), null)
                .andExpect(jsonPath("$.code").value("AVAILABILITY_DURATION_INVALID"));
        addSlot(ARTIST, Instant.now().minusSeconds(3600), Instant.now().plusSeconds(3600), null)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("AVAILABILITY_IN_PAST"));
    }

    @Test
    void slotsOfOneArtistCannotOverlap() throws Exception {
        addSlot(ARTIST, at(1, "20:00"), at(1, "23:00"), null).andExpect(status().isCreated());
        addSlot(ARTIST, at(1, "22:00"), at(2, "02:00"), null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("AVAILABILITY_OVERLAP"));
        // Back to back is fine, and other artists are independent.
        addSlot(ARTIST, at(1, "23:00"), at(2, "02:00"), null).andExpect(status().isCreated());
        addSlot(OTHER_ARTIST, at(1, "21:00"), at(1, "23:00"), null).andExpect(status().isCreated());
    }

    @Test
    void updatesAndDeletesOwnSlotsOnly() throws Exception {
        var id = id(addSlot(ARTIST, at(1, "20:00"), at(1, "23:00"), null));

        as(ARTIST, put("/api/v1/availability/me/slots/" + id).contentType(MediaType.APPLICATION_JSON)
                .content(slotJson(at(1, "21:00"), at(2, "01:00"), "dłużej")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.startsAt").value(at(1, "21:00").toString()))
                .andExpect(jsonPath("$.note").value("dłużej"));
        as(OTHER_ARTIST, delete("/api/v1/availability/me/slots/" + id))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("AVAILABILITY_SLOT_NOT_FOUND"));
        as(ARTIST, delete("/api/v1/availability/me/slots/" + id)).andExpect(status().isNoContent());
        calendar(ARTIST, at(0, "00:00"), at(7, "00:00")).andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void weeklyRulesExpandInTheArtistsTimeZone() throws Exception {
        addRule(ARTIST, "[\"FRIDAY\", \"SATURDAY\"]", "21:00", 360, MONDAY, MONDAY.plusDays(11))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.timeZone").value("Europe/Warsaw"))
                .andExpect(jsonPath("$.days", contains("FRIDAY", "SATURDAY")));

        // The rule ends on the second Friday (inclusive): two Fridays and one Saturday.
        calendar(ARTIST, at(0, "00:00"), at(21, "00:00"))
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].startsAt").value(at(4, "21:00").toString()))
                .andExpect(jsonPath("$[0].endsAt").value(at(5, "03:00").toString()))
                .andExpect(jsonPath("$[0].source").value("RULE"))
                .andExpect(jsonPath("$[0].date").value(MONDAY.plusDays(4).toString()))
                .andExpect(jsonPath("$[1].startsAt").value(at(5, "21:00").toString()))
                .andExpect(jsonPath("$[2].startsAt").value(at(11, "21:00").toString()));
    }

    @Test
    void rulesKeepTheirLocalTimeAcrossTheClockChange() throws Exception {
        // The last Sunday of October ends summer time; use the next one that is still ahead.
        var change = LocalDate.of(LocalDate.now(WARSAW).getYear(), 10, 31)
                .with(TemporalAdjusters.lastInMonth(DayOfWeek.SUNDAY));
        if (!change.isAfter(LocalDate.now(WARSAW).plusDays(3))) {
            change = LocalDate.of(change.getYear() + 1, 10, 31).with(TemporalAdjusters.lastInMonth(DayOfWeek.SUNDAY));
        }
        var fridayBefore = change.minusDays(2);
        addRule(ARTIST, "[\"FRIDAY\"]", "21:00", 360, fridayBefore, null).andExpect(status().isCreated());

        var from = fridayBefore.atStartOfDay(WARSAW).toInstant();
        calendar(ARTIST, from, from.plusSeconds(10 * 86400))
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].startsAt").value(fridayBefore.atTime(19, 0).toInstant(
                        java.time.ZoneOffset.UTC).toString()))
                .andExpect(jsonPath("$[1].startsAt").value(fridayBefore.plusDays(7).atTime(20, 0).toInstant(
                        java.time.ZoneOffset.UTC).toString()));
    }

    @Test
    void oneDateOfARuleCanBeSkippedAndRestored() throws Exception {
        var rule = id(addRule(ARTIST, "[\"FRIDAY\"]", "21:00", 360, MONDAY, null));
        var friday = MONDAY.plusDays(4);

        as(ARTIST, delete("/api/v1/availability/me/rules/" + rule + "/dates/" + friday))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.skippedDates", contains(friday.toString())));
        calendar(ARTIST, at(0, "00:00"), at(14, "00:00"))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].date").value(friday.plusDays(7).toString()));

        as(ARTIST, delete("/api/v1/availability/me/rules/" + rule + "/dates/" + friday.plusDays(1)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("AVAILABILITY_NOT_A_RULE_DATE"));
        as(ARTIST, put("/api/v1/availability/me/rules/" + rule + "/dates/" + friday))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.skippedDates").isEmpty());
        calendar(ARTIST, at(0, "00:00"), at(14, "00:00")).andExpect(jsonPath("$", hasSize(2)));
    }

    @Test
    void rulesAndSlotsCannotOverlapEitherWay() throws Exception {
        addRule(ARTIST, "[\"FRIDAY\"]", "21:00", 360, MONDAY, null).andExpect(status().isCreated());
        addSlot(ARTIST, at(11, "23:00"), at(12, "01:00"), null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("AVAILABILITY_OVERLAP"));

        addSlot(ARTIST, at(2, "20:00"), at(2, "23:00"), null).andExpect(status().isCreated());
        addRule(ARTIST, "[\"WEDNESDAY\"]", "22:00", 120, MONDAY, null)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("AVAILABILITY_OVERLAP"));
        addRule(ARTIST, "[\"FRIDAY\"]", "18:00", 240, MONDAY, null)
                .andExpect(jsonPath("$.code").value("AVAILABILITY_OVERLAP"));
        as(ARTIST, get("/api/v1/availability/me/rules")).andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void checksRangesRulesAndLimits() throws Exception {
        calendar(ARTIST, at(0, "00:00"), at(93, "00:00"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("AVAILABILITY_RANGE_INVALID"));
        addRule(ARTIST, "[]", "21:00", 360, MONDAY, null).andExpect(status().isBadRequest());
        addRule(ARTIST, "[\"FRIDAY\"]", "21:00", 360, MONDAY, MONDAY.minusDays(1))
                .andExpect(jsonPath("$.code").value("AVAILABILITY_RULE_DATES_INVALID"));
        addRule(ARTIST, "[\"FRIDAY\"]", "21:00", 360, LocalDate.now(WARSAW).minusDays(1), null)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("AVAILABILITY_IN_PAST"));

        // Twenty one-hour rules on different days and hours fill the limit.
        for (int i = 0; i < 20; i++) {
            var day = DayOfWeek.of(i % 7 + 1);
            addRule(ARTIST, "[\"" + day + "\"]", String.format("%02d:00", i / 7 * 2), 60, MONDAY, null)
                    .andExpect(status().isCreated());
        }
        addRule(ARTIST, "[\"MONDAY\"]", "20:00", 60, MONDAY, null)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("AVAILABILITY_LIMIT_REACHED"));
    }

    @Test
    void needsAnArtistWithAProfile() throws Exception {
        as(NO_PROFILE, "ARTIST", get("/api/v1/availability/me/rules"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("AVAILABILITY_PROFILE_REQUIRED"));
        as(ARTIST, "VENUE", get("/api/v1/availability/me/rules")).andExpect(status().isForbidden());
    }

    @Test
    void publishedProfilesShowTheirCalendarWithoutNotes() throws Exception {
        addSlot(ARTIST, at(1, "20:00"), at(1, "23:00"), "prywatne").andExpect(status().isCreated());
        var slug = jdbc.queryForObject("SELECT slug FROM artist_profile WHERE owner_id = ?", String.class, ARTIST);
        var path = "/api/v1/public/artists/" + slug + "/availability";

        mockMvc.perform(get(path).param("from", at(0, "00:00").toString()).param("to", at(7, "00:00").toString()))
                .andExpect(status().isNotFound());

        jdbc.update("UPDATE artist_profile SET published_at = now() WHERE owner_id = ?", ARTIST);
        mockMvc.perform(get(path).param("from", at(0, "00:00").toString()).param("to", at(7, "00:00").toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].status").value("FREE"))
                .andExpect(jsonPath("$[0].note").doesNotExist())
                .andExpect(jsonPath("$[0].slotId").doesNotExist());
    }

    @Test
    void theFacadeChecksOccupiesAndReleasesFreeTime() throws Exception {
        var slot = id(addSlot(ARTIST, at(1, "20:00"), at(2, "02:00"), null));
        addRule(OTHER_ARTIST, "[\"FRIDAY\"]", "21:00", 360, MONDAY, null).andExpect(status().isCreated());

        assertThat(availability.isFree(ARTIST, at(1, "22:00"), at(2, "01:00"))).isTrue();
        assertThat(availability.isFree(ARTIST, at(1, "19:00"), at(1, "22:00"))).isFalse();
        assertThat(availability.freeAmong(Set.of(ARTIST, OTHER_ARTIST, NO_PROFILE), at(4, "22:00"), at(5, "01:00")))
                .containsExactly(OTHER_ARTIST);

        var booking = UUID.randomUUID();
        availability.occupy(ARTIST, at(1, "22:00"), at(2, "01:00"), booking);
        assertThat(availability.isFree(ARTIST, at(1, "22:00"), at(2, "01:00"))).isFalse();
        calendar(ARTIST, at(0, "00:00"), at(3, "00:00")).andExpect(jsonPath("$[0].status").value("BOOKED"));
        as(ARTIST, delete("/api/v1/availability/me/slots/" + slot))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("AVAILABILITY_SLOT_BOOKED"));
        assertThatThrownBy(() -> availability.occupy(ARTIST, at(1, "22:00"), at(2, "01:00"), UUID.randomUUID()))
                .isInstanceOf(DomainException.class)
                .hasMessage("AVAILABILITY_NOT_FREE");

        // A rule date that gets booked becomes its own booked slot, and the rule skips that date.
        var ruleBooking = UUID.randomUUID();
        availability.occupy(OTHER_ARTIST, at(4, "22:00"), at(5, "01:00"), ruleBooking);
        calendar(OTHER_ARTIST, at(0, "00:00"), at(7, "00:00"))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].source").value("SLOT"))
                .andExpect(jsonPath("$[0].status").value("BOOKED"))
                .andExpect(jsonPath("$[0].startsAt").value(at(4, "21:00").toString()));

        availability.release(booking);
        assertThat(availability.isFree(ARTIST, at(1, "22:00"), at(2, "01:00"))).isTrue();
    }

    private Instant at(int daysAfterMonday, String time) {
        return MONDAY.plusDays(daysAfterMonday).atTime(LocalTime.parse(time)).atZone(WARSAW).toInstant();
    }

    private ResultActions addSlot(UUID artist, Instant startsAt, Instant endsAt, String note) throws Exception {
        return as(artist, post("/api/v1/availability/me/slots").contentType(MediaType.APPLICATION_JSON)
                .content(slotJson(startsAt, endsAt, note)));
    }

    private static String slotJson(Instant startsAt, Instant endsAt, String note) {
        return "{\"startsAt\": \"" + startsAt + "\", \"endsAt\": \"" + endsAt + "\""
                + (note != null ? ", \"note\": \"" + note + "\"" : "") + "}";
    }

    private ResultActions addRule(UUID artist, String days, String startTime, int minutes, LocalDate validFrom,
            LocalDate validUntil) throws Exception {
        return as(artist, post("/api/v1/availability/me/rules").contentType(MediaType.APPLICATION_JSON)
                .content("{\"days\": " + days + ", \"startTime\": \"" + startTime + "\", \"durationMinutes\": "
                        + minutes + ", \"validFrom\": \"" + validFrom + "\""
                        + (validUntil != null ? ", \"validUntil\": \"" + validUntil + "\"" : "") + "}"));
    }

    private ResultActions calendar(UUID artist, Instant from, Instant to) throws Exception {
        return as(artist, get("/api/v1/availability/me").param("from", from.toString()).param("to", to.toString()));
    }

    private static String id(ResultActions result) throws Exception {
        return JsonPath.read(result.andReturn().getResponse().getContentAsString(), "$.id");
    }

    private ResultActions as(UUID user, MockHttpServletRequestBuilder request) throws Exception {
        return as(user, "ARTIST", request);
    }

    private ResultActions as(UUID user, String role, MockHttpServletRequestBuilder request) throws Exception {
        return mockMvc.perform(request.with(jwt().jwt(token -> token.subject(user.toString()))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role))));
    }
}
