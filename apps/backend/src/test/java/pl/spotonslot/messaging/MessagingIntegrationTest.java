package pl.spotonslot.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import pl.spotonslot.messaging.application.UnreadReminders;
import pl.spotonslot.support.IntegrationTest;

@IntegrationTest
class MessagingIntegrationTest {

    private static final ZoneId WARSAW = ZoneId.of("Europe/Warsaw");
    private static final UUID ARTIST = UUID.fromString("0190a5d2-0000-7000-8000-0000000001f1");
    private static final UUID DRAFT_ARTIST = UUID.fromString("0190a5d2-0000-7000-8000-0000000001f2");
    private static final UUID OWNER = UUID.fromString("0190a5d2-0000-7000-8000-0000000001f3");
    private static final UUID MANAGER = UUID.fromString("0190a5d2-0000-7000-8000-0000000001f4");
    private static final UUID OTHER_OWNER = UUID.fromString("0190a5d2-0000-7000-8000-0000000001f5");
    private static final UUID NEWCOMER = UUID.fromString("0190a5d2-0000-7000-8000-0000000001f6");
    private static final UUID VENUE = UUID.fromString("0190a5d2-0000-7000-8000-0000000001a1");
    private static final UUID OTHER_VENUE = UUID.fromString("0190a5d2-0000-7000-8000-0000000001a2");
    private static final UUID DRAFT_VENUE = UUID.fromString("0190a5d2-0000-7000-8000-0000000001a3");
    private static final List<UUID> PEOPLE = List.of(ARTIST, DRAFT_ARTIST, OWNER, MANAGER, OTHER_OWNER, NEWCOMER);

    private static final LocalDate MONDAY = LocalDate.now(WARSAW).plusWeeks(1).with(
            TemporalAdjusters.next(DayOfWeek.MONDAY));

    @MockitoBean
    JavaMailSenderImpl mailSender;

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    UnreadReminders reminders;

    @Autowired
    Conversations conversations;

    private String slug;

    @BeforeEach
    void seed() throws Exception {
        when(mailSender.createMimeMessage())
                .thenAnswer(invocation -> new MimeMessage(Session.getInstance(new Properties())));
        jdbc.update("DELETE FROM conversation");
        jdbc.update("DELETE FROM notification_preference");
        jdbc.update("DELETE FROM notification");
        jdbc.update("DELETE FROM booking");
        jdbc.update("DELETE FROM listing");
        jdbc.update("DELETE FROM availability_slot");
        jdbc.update("DELETE FROM availability_rule");
        jdbc.update("DELETE FROM artist_profile");
        jdbc.update("DELETE FROM venue");
        for (var person : PEOPLE) {
            account(person, person.equals(ARTIST) || person.equals(DRAFT_ARTIST) ? "ARTIST" : "VENUE");
        }
        for (var artist : List.of(ARTIST, DRAFT_ARTIST)) {
            as(artist, "ARTIST", put("/api/v1/artists/me").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"stageName\": \"DJ " + artist.toString().substring(34) + "\"}"))
                    .andExpect(status().isOk());
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
    void oneConversationPerPairForTheArtistAndTheWholeTeam() throws Exception {
        var id = id(startToArtist(OWNER, VENUE, "Cześć, zagrasz u nas?", "c1")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.kind").value("DIRECT"))
                .andExpect(jsonPath("$.bookingId").doesNotExist())
                .andExpect(jsonPath("$.venueId").value(VENUE.toString()))
                .andExpect(jsonPath("$.myParty").value("VENUE"))
                .andExpect(jsonPath("$.other.name").value("DJ f1"))
                .andExpect(jsonPath("$.other.slug").value(slug))
                .andExpect(jsonPath("$.lastMessage.body").value("Cześć, zagrasz u nas?"))
                .andExpect(jsonPath("$.lastMessage.mine").value(true))
                .andExpect(jsonPath("$.unreadCount").value(0))
                .andExpect(jsonPath("$.canWrite").value(true)));
        // The teammate's "Napisz" opens the same conversation.
        startToArtist(MANAGER, VENUE, "Dzień dobry", null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id));

        as(ARTIST, "ARTIST", get("/api/v1/conversations"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].id").value(id))
                .andExpect(jsonPath("$.content[0].myParty").value("ARTIST"))
                .andExpect(jsonPath("$.content[0].other.name").value("Pod Ziemią"))
                .andExpect(jsonPath("$.content[0].other.slug").value("pod-ziemia"))
                .andExpect(jsonPath("$.content[0].unreadCount").value(2))
                .andExpect(jsonPath("$.content[0].lastMessage.body").value("Dzień dobry"))
                .andExpect(jsonPath("$.content[0].lastMessage.mine").value(false));
        as(ARTIST, "ARTIST", get("/api/v1/conversations/unread-count"))
                .andExpect(jsonPath("$.conversations").value(1))
                .andExpect(jsonPath("$.messages").value(2));
        assertThat(conversations.unreadCount(ARTIST)).isEqualTo(1);
        // A teammate's message is not unread for the other teammate.
        as(OWNER, "VENUE", get("/api/v1/conversations/unread-count")).andExpect(jsonPath("$.messages").value(0));

        as(OTHER_OWNER, "VENUE", get("/api/v1/conversations/" + id + "/messages"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("MESSAGING_CONVERSATION_NOT_FOUND"));
        as(OTHER_OWNER, "VENUE", get("/api/v1/conversations")).andExpect(jsonPath("$.content").isEmpty());

        // Leaving the team ends access; joining it shows the whole history.
        jdbc.update("DELETE FROM venue_member WHERE venue_id = ? AND user_id = ?", VENUE, MANAGER);
        as(MANAGER, "VENUE", get("/api/v1/conversations/" + id)).andExpect(status().isNotFound());
        member(VENUE, NEWCOMER, "MANAGER");
        as(NEWCOMER, "VENUE", get("/api/v1/conversations/" + id + "/messages"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.messages", hasSize(2)))
                .andExpect(jsonPath("$.messages[0].body").value("Dzień dobry"))
                .andExpect(jsonPath("$.messages[0].mine").value(true))
                .andExpect(jsonPath("$.messages[0].side").value("VENUE"));

        send(ARTIST, "ARTIST", id, "Chętnie!", null).andExpect(status().isCreated())
                .andExpect(jsonPath("$.mine").value(true))
                .andExpect(jsonPath("$.side").value("ARTIST"));
        as(NEWCOMER, "VENUE", get("/api/v1/conversations").param("venueId", VENUE.toString()))
                .andExpect(jsonPath("$.content[0].unreadCount").value(1))
                .andExpect(jsonPath("$.content[0].lastMessage.body").value("Chętnie!"));
        as(OWNER, "VENUE", get("/api/v1/conversations").param("venueId", OTHER_VENUE.toString()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("MESSAGING_VENUE_NOT_FOUND"));
        // An artist's reply in its own conversation does not count against starting new ones.
        assertThat(jdbc.queryForObject("SELECT started_by FROM conversation WHERE id = ?::uuid", UUID.class, id))
                .isEqualTo(OWNER);
    }

    @Test
    void startingNeedsPublishedSidesAndAKnownRecipient() throws Exception {
        startToVenue(DRAFT_ARTIST, "pod-ziemia", "Hej")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("MESSAGING_NOT_PUBLISHED"));
        startToVenue(ARTIST, "szkic", "Hej")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("MESSAGING_RECIPIENT_NOT_FOUND"));
        startToArtist(OWNER, DRAFT_VENUE, "Hej", null)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("MESSAGING_NOT_PUBLISHED"));
        startToArtist(OWNER, OTHER_VENUE, "Hej", null)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("MESSAGING_VENUE_NOT_FOUND"));
        as(OWNER, "VENUE", post("/api/v1/conversations").contentType(MediaType.APPLICATION_JSON)
                .content("{\"venueId\": \"" + VENUE + "\", \"artistSlug\": \"nikt\", \"body\": \"Hej\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("MESSAGING_RECIPIENT_NOT_FOUND"));
        // Artists write to venues and venues to artists, not artist to artist.
        as(ARTIST, "ARTIST", post("/api/v1/conversations").contentType(MediaType.APPLICATION_JSON)
                .content("{\"artistSlug\": \"" + slug + "\", \"body\": \"Hej\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MESSAGING_REQUEST_INVALID"));
        as(ARTIST, "ARTIST", post("/api/v1/conversations").contentType(MediaType.APPLICATION_JSON)
                .content("{\"venueSlug\": \"pod-ziemia\", \"body\": \"" + "x".repeat(2001) + "\"}"))
                .andExpect(status().isBadRequest());
        as(ARTIST, "ARTIST", post("/api/v1/conversations").contentType(MediaType.APPLICATION_JSON)
                .content("{\"venueSlug\": \"pod-ziemia\", \"body\": \"   \"}"))
                .andExpect(status().isBadRequest());

        startToVenue(ARTIST, "pod-ziemia", "Hej, gram techno")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.other.name").value("Pod Ziemią"));
        as(MANAGER, "VENUE", get("/api/v1/conversations"))
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].other.name").value("DJ f1"))
                .andExpect(jsonPath("$.content[0].unreadCount").value(1));
    }

    @Test
    void historyPagesByCursorAndARetriedSendIsNotDuplicated() throws Exception {
        var id = id(startToArtist(OWNER, VENUE, "m0", null));
        var start = Instant.now().minus(Duration.ofHours(2));
        for (int i = 1; i <= 54; i++) {
            insertMessage(id, OWNER, "VENUE", "m" + i, start.plusSeconds(i * 60L));
        }
        jdbc.update("UPDATE conversation_message SET created_at = ? WHERE body = 'm0'", Timestamp.from(start));

        var first = as(ARTIST, "ARTIST", get("/api/v1/conversations/" + id + "/messages"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.messages", hasSize(50)))
                .andExpect(jsonPath("$.messages[0].body").value("m54"))
                .andExpect(jsonPath("$.messages[49].body").value("m5"))
                .andExpect(jsonPath("$.hasMore").value(true));
        String oldest = JsonPath.read(first.andReturn().getResponse().getContentAsString(), "$.messages[49].id");
        as(ARTIST, "ARTIST", get("/api/v1/conversations/" + id + "/messages").param("before", oldest))
                .andExpect(jsonPath("$.messages", hasSize(5)))
                .andExpect(jsonPath("$.messages[0].body").value("m4"))
                .andExpect(jsonPath("$.messages[4].body").value("m0"))
                .andExpect(jsonPath("$.hasMore").value(false));
        as(ARTIST, "ARTIST", get("/api/v1/conversations/" + id + "/messages").param("size", "3"))
                .andExpect(jsonPath("$.messages", hasSize(3)));

        var sent = id(send(ARTIST, "ARTIST", id, "Raz", "retry-1").andExpect(status().isCreated()));
        send(ARTIST, "ARTIST", id, "Raz", "retry-1")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(sent));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM conversation_message WHERE body = 'Raz'",
                Integer.class)).isEqualTo(1);
    }

    @Test
    void readStateCountsAndShowsTheOtherSide() throws Exception {
        var id = id(startToArtist(OWNER, VENUE, "Pierwsza", null));
        var second = id(send(MANAGER, "VENUE", id, "Druga", null));
        String firstId = JsonPath.read(as(ARTIST, "ARTIST", get("/api/v1/conversations/" + id + "/messages"))
                .andReturn().getResponse().getContentAsString(), "$.messages[1].id");

        read(ARTIST, "ARTIST", id, firstId).andExpect(status().isNoContent());
        as(ARTIST, "ARTIST", get("/api/v1/conversations/" + id)).andExpect(jsonPath("$.unreadCount").value(1));
        as(OWNER, "VENUE", get("/api/v1/conversations/" + id + "/messages"))
                .andExpect(jsonPath("$.otherReadUpTo").isNotEmpty());
        read(ARTIST, "ARTIST", id, second).andExpect(status().isNoContent());
        // Reading an older message later does not move the mark back.
        read(ARTIST, "ARTIST", id, firstId).andExpect(status().isNoContent());
        as(ARTIST, "ARTIST", get("/api/v1/conversations/unread-count")).andExpect(jsonPath("$.conversations").value(0));
        var readUpTo = jdbc.queryForObject("SELECT created_at FROM conversation_message WHERE id = ?::uuid",
                Timestamp.class, second).toInstant();
        as(OWNER, "VENUE", get("/api/v1/conversations/" + id))
                .andExpect(jsonPath("$.otherReadUpTo").value(readUpTo.toString()));

        read(ARTIST, "ARTIST", id, UUID.randomUUID().toString())
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("MESSAGING_MESSAGE_NOT_FOUND"));
    }

    @Test
    void twentyNewConversationsADayAndThirtyMessagesAMinute() throws Exception {
        var today = Instant.now();
        for (int i = 0; i < 20; i++) {
            insertConversation(UUID.randomUUID(), VENUE, OWNER, today);
        }
        startToArtist(OWNER, VENUE, "Hej", null)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("MESSAGING_LIMIT"));
        // The limit is the person's: a teammate may still start one.
        var id = id(startToArtist(MANAGER, VENUE, "Hej", null).andExpect(status().isCreated()));
        // Writing in an existing conversation is not limited by it.
        send(OWNER, "VENUE", id, "Dalej piszę", null).andExpect(status().isCreated());

        for (int i = 0; i < 29; i++) {
            insertMessage(id, ARTIST, "ARTIST", "szybko " + i, Instant.now().minusSeconds(10));
        }
        send(ARTIST, "ARTIST", id, "30.", null).andExpect(status().isCreated());
        send(ARTIST, "ARTIST", id, "31.", null)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("MESSAGING_RATE"));
        jdbc.update("UPDATE conversation_message SET created_at = created_at - interval '2 minutes'"
                + " WHERE sender_id = ?", ARTIST);
        send(ARTIST, "ARTIST", id, "31.", null).andExpect(status().isCreated());
    }

    @Test
    void blockingStopsTheDirectConversationButNotBookingThreads() throws Exception {
        var id = id(startToArtist(OWNER, VENUE, "Hej", null));
        as(ARTIST, "ARTIST", put("/api/v1/conversations/" + id + "/block"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.blockedByMe").value(true))
                .andExpect(jsonPath("$.blockedByOther").value(false))
                .andExpect(jsonPath("$.canWrite").value(false));
        as(MANAGER, "VENUE", get("/api/v1/conversations/" + id))
                .andExpect(jsonPath("$.blockedByMe").value(false))
                .andExpect(jsonPath("$.blockedByOther").value(true))
                .andExpect(jsonPath("$.canWrite").value(false));
        send(MANAGER, "VENUE", id, "Halo?", null)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("MESSAGING_BLOCKED"));
        startToArtist(OWNER, VENUE, "Halo?", null)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("MESSAGING_BLOCKED"));
        send(ARTIST, "ARTIST", id, "Jednak", null)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("MESSAGING_BLOCKED"));

        // The booking thread with the same venue still works.
        var thread = bookingThread();
        send(OWNER, "VENUE", thread, "O występie", null).andExpect(status().isCreated());
        as(ARTIST, "ARTIST", put("/api/v1/conversations/" + thread + "/block"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MESSAGING_DIRECT_ONLY"));

        // Only the side that blocked lifts it.
        as(OWNER, "VENUE", delete("/api/v1/conversations/" + id + "/block"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.blockedByOther").value(true));
        as(ARTIST, "ARTIST", delete("/api/v1/conversations/" + id + "/block"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.blockedByMe").value(false))
                .andExpect(jsonPath("$.canWrite").value(true));
        send(MANAGER, "VENUE", id, "Halo?", null).andExpect(status().isCreated());
    }

    @Test
    void everyBookingGetsAThreadForBothSides() throws Exception {
        var bookingId = request();
        var thread = awaitThread(bookingId);
        as(OWNER, "VENUE", get("/api/v1/bookings/" + bookingId))
                .andExpect(jsonPath("$.conversationId").value(thread));
        as(ARTIST, "ARTIST", get("/api/v1/bookings").param("awaitingMe", "true"))
                .andExpect(jsonPath("$.content[0].conversationId").value(thread));
        // Empty threads stay out of the list; they open from the booking.
        as(ARTIST, "ARTIST", get("/api/v1/conversations")).andExpect(jsonPath("$.content").isEmpty());
        as(ARTIST, "ARTIST", get("/api/v1/conversations/" + thread))
                .andExpect(jsonPath("$.kind").value("BOOKING"))
                .andExpect(jsonPath("$.bookingId").value(bookingId))
                .andExpect(jsonPath("$.other.name").value("Pod Ziemią"))
                .andExpect(jsonPath("$.lastMessage").doesNotExist());

        send(MANAGER, "VENUE", thread, "Jaki sprzęt przywozisz?", null).andExpect(status().isCreated());
        as(ARTIST, "ARTIST", get("/api/v1/conversations"))
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].kind").value("BOOKING"))
                .andExpect(jsonPath("$.content[0].unreadCount").value(1));
        as(OTHER_OWNER, "VENUE", get("/api/v1/conversations/" + thread)).andExpect(status().isNotFound());
        // A booking thread is not a new conversation for the daily limit, and a direct one is separate.
        startToArtist(OWNER, VENUE, "Osobno", null).andExpect(status().isCreated())
                .andExpect(jsonPath("$.kind").value("DIRECT"));
        // The thread stays after the booking ends.
        as(OWNER, "VENUE", post("/api/v1/bookings/" + bookingId + "/withdraw")).andExpect(status().isOk());
        send(ARTIST, "ARTIST", thread, "Szkoda", null).andExpect(status().isCreated());
    }

    @Test
    void anUnreadMessageIsMailedOnceAfterTenMinutesUntilRead() throws Exception {
        var id = id(startToVenue(ARTIST, "pod-ziemia", "Hej, gram techno"));
        assertThat(reminders.run()).isZero();
        preferences(MANAGER, false);
        backdate(11);
        assertThat(reminders.run()).isEqualTo(2);

        var mail = captureMails(1).getFirst();
        assertThat(to(mail)).isEqualTo(email(OWNER));
        assertThat(mail.getSubject()).isEqualTo("Masz nową wiadomość od DJ f1");
        var link = "http://localhost:3000/messages/" + id;
        assertThat(part(mail, "text/plain")).contains(link).doesNotContain("gram techno");
        assertThat(part(mail, "text/html")).contains("href=\"" + link + "\"").contains("Odpowiedz");

        // Once per conversation until read.
        clearInvocations(mailSender);
        send(ARTIST, "ARTIST", id, "Jesteście tam?", null);
        backdate(11);
        assertThat(reminders.run()).isZero();
        read(OWNER, "VENUE", id, lastMessage(id)).andExpect(status().isNoContent());
        send(ARTIST, "ARTIST", id, "Halo?", null);
        assertThat(reminders.run()).isZero();
        backdate(11);
        assertThat(reminders.run()).isEqualTo(1);
        verify(mailSender, timeout(10_000).times(1)).send(any(MimeMessage.class));

        // Once somebody on the team answered, nobody on it is mailed; the artist hears about the answer.
        clearInvocations(mailSender);
        send(ARTIST, "ARTIST", id, "Jeszcze jedno", null);
        send(MANAGER, "VENUE", id, "Już odpisuję", null);
        backdate(11);
        assertThat(reminders.run()).isEqualTo(1);
        var answer = captureMails(1).getFirst();
        assertThat(to(answer)).isEqualTo(email(ARTIST));
        assertThat(answer.getSubject()).isEqualTo("Masz nową wiadomość od Pod Ziemią");
    }

    // ---- helpers

    private void preferences(UUID user, boolean messageEmail) throws Exception {
        as(user, "VENUE", put("/api/v1/notifications/preferences").contentType(MediaType.APPLICATION_JSON)
                .content("{\"nearbyListings\": {\"enabled\": true, \"email\": true}, \"messages\": {\"email\": "
                        + messageEmail + "}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.messages.email").value(messageEmail));
    }

    private void backdate(int minutes) {
        jdbc.update("UPDATE conversation_message SET created_at = created_at - make_interval(mins => ?)", minutes);
        jdbc.update("UPDATE conversation SET last_message_at = last_message_at - make_interval(mins => ?)",
                minutes);
        jdbc.update("UPDATE conversation_read SET read_up_to = read_up_to - make_interval(mins => ?),"
                + " read_at = read_at - make_interval(mins => ?), reminded_at = reminded_at - make_interval(mins => ?)",
                minutes, minutes, minutes);
    }

    private String lastMessage(String conversation) {
        return jdbc.queryForObject("SELECT id::text FROM conversation_message WHERE conversation_id = ?::uuid"
                + " ORDER BY created_at DESC, id DESC LIMIT 1", String.class, conversation);
    }

    private String bookingThread() throws Exception {
        return awaitThread(request());
    }

    private String request() throws Exception {
        as(ARTIST, "ARTIST", post("/api/v1/availability/me/slots").contentType(MediaType.APPLICATION_JSON)
                .content("{\"startsAt\": \"" + at(4, "21:00") + "\", \"endsAt\": \"" + at(5, "04:00") + "\"}"))
                .andExpect(status().isCreated());
        return id(as(OWNER, "VENUE", post("/api/v1/bookings").contentType(MediaType.APPLICATION_JSON)
                .content("{\"venueId\": \"" + VENUE + "\", \"artistSlug\": \"" + slug + "\", \"startsAt\": \""
                        + at(4, "22:00") + "\", \"endsAt\": \"" + at(5, "02:00") + "\", \"amount\": 0}"))
                .andExpect(status().isCreated()));
    }

    private String awaitThread(String bookingId) {
        await().atMost(Duration.ofSeconds(10)).until(() -> jdbc.queryForObject(
                "SELECT count(*) FROM conversation WHERE booking_id = ?::uuid", Integer.class, bookingId) == 1);
        return jdbc.queryForObject("SELECT id::text FROM conversation WHERE booking_id = ?::uuid", String.class,
                bookingId);
    }

    private ResultActions startToArtist(UUID user, UUID venue, String body, String clientId) throws Exception {
        return as(user, "VENUE", post("/api/v1/conversations").contentType(MediaType.APPLICATION_JSON)
                .content("{\"venueId\": \"" + venue + "\", \"artistSlug\": \"" + slug + "\", \"body\": \"" + body
                        + "\"" + (clientId == null ? "" : ", \"clientId\": \"" + clientId + "\"") + "}"));
    }

    private ResultActions startToVenue(UUID user, String venueSlug, String body) throws Exception {
        return as(user, "ARTIST", post("/api/v1/conversations").contentType(MediaType.APPLICATION_JSON)
                .content("{\"venueSlug\": \"" + venueSlug + "\", \"body\": \"" + body + "\"}"));
    }

    private ResultActions send(UUID user, String role, String conversation, String body, String clientId)
            throws Exception {
        return as(user, role, post("/api/v1/conversations/" + conversation + "/messages")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"body\": \"" + body + "\"" + (clientId == null ? "" : ", \"clientId\": \"" + clientId
                        + "\"") + "}"));
    }

    private ResultActions read(UUID user, String role, String conversation, String messageId) throws Exception {
        return as(user, role, post("/api/v1/conversations/" + conversation + "/read")
                .contentType(MediaType.APPLICATION_JSON).content("{\"messageId\": \"" + messageId + "\"}"));
    }

    private void insertConversation(UUID artist, UUID venue, UUID startedBy, Instant at) {
        var now = Timestamp.from(at);
        jdbc.update("INSERT INTO conversation (id, created_at, updated_at, version, kind, artist_id, venue_id,"
                + " artist_name, venue_name, started_by, last_message_at) VALUES (?, ?, ?, 0, 'DIRECT', ?, ?, 'X',"
                + " 'Y', ?, ?)", UUID.randomUUID(), now, now, artist, venue, startedBy, now);
    }

    private void insertMessage(String conversation, UUID sender, String side, String body, Instant at) {
        var time = Timestamp.from(at);
        jdbc.update("INSERT INTO conversation_message (id, created_at, updated_at, version, conversation_id,"
                + " sender_id, sender_side, body) VALUES (?, ?, ?, 0, ?::uuid, ?, ?, ?)", UUID.randomUUID(), time,
                time, conversation, sender, side, body);
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

    private static String email(UUID user) {
        return user.toString().substring(30) + "@messages.example.com";
    }

    private void account(UUID id, String role) {
        var now = Timestamp.from(Instant.now());
        jdbc.update("DELETE FROM identity_user WHERE id = ?", id);
        jdbc.update("INSERT INTO identity_user (id, created_at, updated_at, version, email, password_hash, role,"
                + " status, locale, privacy_notice_accepted_at, email_verified_at) VALUES (?, ?, ?, 0, ?, 'x', ?,"
                + " 'ACTIVE', 'pl', ?, ?)", id, now, now, email(id), role, now, now);
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

    private static Instant at(int dayOffset, String time) {
        return MONDAY.plusDays(dayOffset).atTime(LocalTime.parse(time)).atZone(WARSAW).toInstant();
    }

    private static String id(ResultActions result) throws Exception {
        return JsonPath.read(result.andReturn().getResponse().getContentAsString(), "$.id");
    }

    private ResultActions as(UUID user, String role, MockHttpServletRequestBuilder request) throws Exception {
        return mockMvc.perform(request.with(jwt().jwt(token -> token.subject(user.toString()))
                .authorities(new SimpleGrantedAuthority("ROLE_" + role))));
    }
}
