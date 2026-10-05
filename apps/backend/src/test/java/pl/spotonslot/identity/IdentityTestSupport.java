package pl.spotonslot.identity;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.test.web.servlet.ResultActions;

/** Request helpers shared by the identity integration tests. */
final class IdentityTestSupport {

    static final String PASSWORD = "correct horse battery";
    static final String REFRESH_COOKIE = "sos_refresh";

    private final MockMvc mockMvc;
    private final ObjectMapper json;

    IdentityTestSupport(MockMvc mockMvc, ObjectMapper json) {
        this.mockMvc = mockMvc;
        this.json = json;
    }

    static void clean(JdbcTemplate jdbc) {
        jdbc.update("DELETE FROM identity_refresh_token");
        jdbc.update("DELETE FROM identity_token");
        jdbc.update("DELETE FROM identity_user");
    }

    ResultActions post(String path, Map<String, ?> body) throws Exception {
        return mockMvc.perform(MockMvcRequestBuilders.post(path)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)));
    }

    ResultActions register(String email, String role) throws Exception {
        return post("/api/v1/auth/register", Map.of("email", email, "password", PASSWORD, "role", role,
                "locale", "pl", "privacyNoticeAccepted", true));
    }

    /** Registers and verifies an account; returns nothing, the account can log in afterwards. */
    void activeAccount(String email, ApplicationEvents events) throws Exception {
        register(email, "ARTIST").andExpect(status().isAccepted());
        post("/api/v1/auth/verify-email", Map.of("token", lastVerificationToken(events, email)))
                .andExpect(status().isNoContent());
    }

    MvcResult login(String email) throws Exception {
        return post("/api/v1/auth/login", Map.of("email", email, "password", PASSWORD))
                .andExpect(status().isOk())
                .andReturn();
    }

    ResultActions refresh(String refreshToken) throws Exception {
        var request = MockMvcRequestBuilders.post("/api/v1/auth/refresh");
        if (refreshToken != null) {
            request.cookie(new Cookie(REFRESH_COOKIE, refreshToken));
        }
        return mockMvc.perform(request);
    }

    static String refreshCookie(MvcResult result) {
        return result.getResponse().getCookie(REFRESH_COOKIE).getValue();
    }

    String accessToken(MvcResult result) throws Exception {
        return json.readTree(result.getResponse().getContentAsString()).get("accessToken").asText();
    }

    static String lastVerificationToken(ApplicationEvents events, String email) {
        return events.stream(EmailVerificationRequested.class)
                .filter(event -> event.email().equals(email))
                .reduce((first, second) -> second)
                .orElseThrow()
                .token();
    }

    static String lastResetToken(ApplicationEvents events, String email) {
        return events.stream(PasswordResetRequested.class)
                .filter(event -> event.email().equals(email))
                .reduce((first, second) -> second)
                .orElseThrow()
                .token();
    }
}
