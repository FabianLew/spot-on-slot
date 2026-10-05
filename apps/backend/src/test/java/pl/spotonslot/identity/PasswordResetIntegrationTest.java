package pl.spotonslot.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.test.web.servlet.MockMvc;
import pl.spotonslot.support.IntegrationTest;

@IntegrationTest
@RecordApplicationEvents
class PasswordResetIntegrationTest {

    private static final String EMAIL = "artist@example.com";
    private static final String NEW_PASSWORD = "a brand new password";

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    ApplicationEvents events;

    IdentityTestSupport api;

    @BeforeEach
    void setUp() {
        IdentityTestSupport.clean(jdbc);
        api = new IdentityTestSupport(mockMvc, json);
    }

    @Test
    void resetSetsNewPasswordAndEndsAllSessions() throws Exception {
        api.activeAccount(EMAIL, events);
        var session = IdentityTestSupport.refreshCookie(api.login(EMAIL));

        api.post("/api/v1/auth/password-reset", Map.of("email", EMAIL)).andExpect(status().isAccepted());
        var token = IdentityTestSupport.lastResetToken(events, EMAIL);
        api.post("/api/v1/auth/password-reset/confirm", Map.of("token", token, "password", NEW_PASSWORD))
                .andExpect(status().isNoContent());

        api.refresh(session).andExpect(status().isUnauthorized());
        api.post("/api/v1/auth/login", Map.of("email", EMAIL, "password", IdentityTestSupport.PASSWORD))
                .andExpect(status().isUnauthorized());
        api.post("/api/v1/auth/login", Map.of("email", EMAIL, "password", NEW_PASSWORD))
                .andExpect(status().isOk());
        // The link works once.
        api.post("/api/v1/auth/password-reset/confirm", Map.of("token", token, "password", NEW_PASSWORD))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("IDENTITY_TOKEN_INVALID"));
    }

    @Test
    void resetVerifiesPendingAccount() throws Exception {
        api.register(EMAIL, "VENUE");
        jdbc.update("UPDATE identity_token SET created_at = now() - interval '2 minutes'");

        api.post("/api/v1/auth/password-reset", Map.of("email", EMAIL)).andExpect(status().isAccepted());
        api.post("/api/v1/auth/password-reset/confirm",
                        Map.of("token", IdentityTestSupport.lastResetToken(events, EMAIL), "password", NEW_PASSWORD))
                .andExpect(status().isNoContent());

        assertThat(jdbc.queryForObject("SELECT status FROM identity_user", String.class)).isEqualTo("ACTIVE");
    }

    @Test
    void sameResponseForUnknownAndBlockedAccounts() throws Exception {
        api.post("/api/v1/auth/password-reset", Map.of("email", "nobody@example.com"))
                .andExpect(status().isAccepted());
        api.activeAccount(EMAIL, events);
        jdbc.update("UPDATE identity_user SET status = 'BLOCKED'");
        api.post("/api/v1/auth/password-reset", Map.of("email", EMAIL)).andExpect(status().isAccepted());

        assertThat(events.stream(PasswordResetRequested.class)).isEmpty();
    }

    @Test
    void rejectsExpiredLinkAndPasswordEqualToEmail() throws Exception {
        api.activeAccount(EMAIL, events);
        api.post("/api/v1/auth/password-reset", Map.of("email", EMAIL)).andExpect(status().isAccepted());
        var token = IdentityTestSupport.lastResetToken(events, EMAIL);

        api.post("/api/v1/auth/password-reset/confirm", Map.of("token", token, "password", "ARTIST@example.com"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("IDENTITY_PASSWORD_EQUALS_EMAIL"));

        jdbc.update("UPDATE identity_token SET expires_at = now() - interval '1 second' WHERE type = 'PASSWORD_RESET'");
        api.post("/api/v1/auth/password-reset/confirm", Map.of("token", token, "password", NEW_PASSWORD))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("IDENTITY_TOKEN_INVALID"));
    }
}
