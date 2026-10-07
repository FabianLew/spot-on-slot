package pl.spotonslot.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;

import java.lang.reflect.Type;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.user.SimpUserRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import pl.spotonslot.identity.IdentityProperties;
import pl.spotonslot.support.TestcontainersConfiguration;

/** Live delivery over STOMP on a real server: only signed-in people, only their own conversations. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class MessagingWebSocketIntegrationTest {

    private static final UUID ARTIST = UUID.fromString("0190a5d2-0000-7000-8000-0000000002f1");
    private static final UUID OWNER = UUID.fromString("0190a5d2-0000-7000-8000-0000000002f3");
    private static final UUID MANAGER = UUID.fromString("0190a5d2-0000-7000-8000-0000000002f4");
    private static final UUID OUTSIDER = UUID.fromString("0190a5d2-0000-7000-8000-0000000002f5");
    private static final UUID VENUE = UUID.fromString("0190a5d2-0000-7000-8000-0000000002a1");

    @LocalServerPort
    int port;

    @Autowired
    TestRestTemplate rest;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    JwtEncoder jwtEncoder;

    @Autowired
    IdentityProperties identity;

    @Autowired
    SimpUserRegistry users;

    private WebSocketStompClient client;
    private final List<StompSession> sessions = new CopyOnWriteArrayList<>();
    private String slug;

    @BeforeEach
    void seed() {
        client = new WebSocketStompClient(new StandardWebSocketClient());
        client.setMessageConverter(new MappingJackson2MessageConverter());
        jdbc.update("DELETE FROM conversation");
        jdbc.update("DELETE FROM booking");
        jdbc.update("DELETE FROM artist_profile");
        jdbc.update("DELETE FROM venue");
        var profile = exchange(ARTIST, "ARTIST", HttpMethod.PUT, "/api/v1/artists/me", "{\"stageName\": \"DJ Fala\"}");
        assertThat(profile).containsKey("slug");
        jdbc.update("UPDATE artist_profile SET published_at = now() WHERE owner_id = ?", ARTIST);
        slug = jdbc.queryForObject("SELECT slug FROM artist_profile WHERE owner_id = ?", String.class, ARTIST);
        var now = Timestamp.from(Instant.now());
        jdbc.update("INSERT INTO venue (id, created_at, updated_at, version, slug, name, type, city, latitude,"
                + " longitude, published_at) VALUES (?, ?, ?, 0, 'fala', 'Fala', 'CLUB', 'Gdańsk', 54.35, 18.65, ?)",
                VENUE, now, now, now);
        for (var member : List.of(OWNER, MANAGER)) {
            jdbc.update("INSERT INTO venue_member (id, created_at, updated_at, version, venue_id, user_id, role)"
                    + " VALUES (?, ?, ?, 0, ?, ?, ?)", UUID.randomUUID(), now, now, VENUE, member,
                    member.equals(OWNER) ? "OWNER" : "MANAGER");
        }
    }

    @AfterEach
    void disconnect() {
        sessions.forEach(session -> {
            if (session.isConnected()) {
                session.disconnect();
            }
        });
        client.stop();
    }

    @Test
    void aConnectionNeedsAValidToken() {
        var withoutToken = new Handler();
        var future = client.connectAsync(url(), new WebSocketHttpHeaders(), new StompHeaders(), withoutToken);
        assertThatThrownBy(() -> future.get(5, TimeUnit.SECONDS)).isNotNull();
        await().atMost(Duration.ofSeconds(5)).until(() -> !withoutToken.errors.isEmpty());

        var badToken = new Handler();
        var headers = new StompHeaders();
        headers.add("Authorization", "Bearer nie-token");
        var bad = client.connectAsync(url(), new WebSocketHttpHeaders(), headers, badToken);
        assertThatThrownBy(() -> bad.get(5, TimeUnit.SECONDS)).isNotNull();
    }

    @Test
    void aMessageReachesTheOtherSideAndTheWholeTeamAndReadReceiptsFollow() throws Exception {
        var artist = subscribe(ARTIST, "ARTIST");
        var owner = subscribe(OWNER, "VENUE");
        var manager = subscribe(MANAGER, "VENUE");
        var outsider = subscribe(OUTSIDER, "VENUE");

        var conversation = exchange(OWNER, "VENUE", HttpMethod.POST, "/api/v1/conversations",
                "{\"venueId\": \"" + VENUE + "\", \"artistSlug\": \"" + slug + "\", \"body\": \"Zagrasz?\"}");
        var id = (String) conversation.get("id");

        await().atMost(Duration.ofSeconds(10)).until(() -> artist.received.size() == 1
                && manager.received.size() == 1 && owner.received.size() == 1);
        var toArtist = artist.received.getFirst();
        assertThat(toArtist).containsEntry("type", "MESSAGE").containsEntry("conversationId", id);
        @SuppressWarnings("unchecked")
        var message = (Map<String, Object>) toArtist.get("message");
        assertThat(message).containsEntry("body", "Zagrasz?").containsEntry("mine", false)
                .containsEntry("side", "VENUE");
        @SuppressWarnings("unchecked")
        var echo = (Map<String, Object>) owner.received.getFirst().get("message");
        assertThat(echo).containsEntry("mine", true);

        exchange(ARTIST, "ARTIST", HttpMethod.POST, "/api/v1/conversations/" + id + "/read",
                "{\"messageId\": \"" + message.get("id") + "\"}");
        await().atMost(Duration.ofSeconds(10)).until(() -> manager.received.size() == 2);
        assertThat(manager.received.get(1)).containsEntry("type", "READ").containsEntry("conversationId", id)
                .containsEntry("side", "ARTIST").containsKey("readUpTo");

        Thread.sleep(300);
        assertThat(outsider.received).isEmpty();
    }

    @Test
    void onlyTheOwnQueueCanBeSubscribed() throws Exception {
        var handler = new Handler();
        var session = connect(OWNER, "VENUE", handler);
        session.subscribe("/topic/everything", new Collector());
        await().atMost(Duration.ofSeconds(5)).until(() -> !handler.errors.isEmpty());
    }

    // ---- helpers

    private Collector subscribe(UUID user, String role) throws Exception {
        var collector = new Collector();
        var session = connect(user, role, new Handler());
        session.subscribe("/user/queue/messages", collector);
        await().atMost(Duration.ofSeconds(5)).until(() -> {
            var registered = users.getUser(user.toString());
            return registered != null && registered.getSessions().stream()
                    .anyMatch(each -> !each.getSubscriptions().isEmpty());
        });
        return collector;
    }

    private StompSession connect(UUID user, String role, Handler handler) throws Exception {
        var headers = new StompHeaders();
        headers.add("Authorization", "Bearer " + token(user, role));
        var session = client.connectAsync(url(), new WebSocketHttpHeaders(), headers, handler).get(5,
                TimeUnit.SECONDS);
        sessions.add(session);
        return session;
    }

    private String url() {
        return "ws://localhost:" + port + "/ws";
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> exchange(UUID user, String role, HttpMethod method, String path, String body) {
        var headers = new HttpHeaders();
        headers.setBearerAuth(token(user, role));
        headers.setContentType(MediaType.APPLICATION_JSON);
        var response = rest.exchange(path, method, new HttpEntity<>(body, headers), Map.class);
        assertThat(response.getStatusCode().is2xxSuccessful()).as(String.valueOf(response.getBody())).isTrue();
        return response.getBody() == null ? Map.of() : response.getBody();
    }

    private String token(UUID user, String role) {
        var now = Instant.now();
        var claims = JwtClaimsSet.builder().issuer(identity.jwtIssuer()).subject(user.toString()).issuedAt(now)
                .expiresAt(now.plusSeconds(600)).claim("role", role).build();
        return jwtEncoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
                .getTokenValue();
    }

    private static final class Handler extends StompSessionHandlerAdapter {

        final List<Object> errors = new CopyOnWriteArrayList<>();

        @Override
        public Type getPayloadType(StompHeaders headers) {
            return byte[].class;
        }

        @Override
        public void handleFrame(StompHeaders headers, Object payload) {
            errors.add(headers);
        }

        @Override
        public void handleException(StompSession session, StompCommand command, StompHeaders headers,
                byte[] payload, Throwable exception) {
            errors.add(exception);
        }

        @Override
        public void handleTransportError(StompSession session, Throwable exception) {
            errors.add(exception);
        }
    }

    private static final class Collector implements StompFrameHandler {

        final List<Map<String, Object>> received = new CopyOnWriteArrayList<>();

        @Override
        public Type getPayloadType(StompHeaders headers) {
            return Map.class;
        }

        @Override
        @SuppressWarnings("unchecked")
        public void handleFrame(StompHeaders headers, Object payload) {
            received.add((Map<String, Object>) payload);
        }
    }
}
