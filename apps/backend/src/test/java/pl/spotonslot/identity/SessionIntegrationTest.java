package pl.spotonslot.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import java.util.Map;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import pl.spotonslot.support.IntegrationTest;

@IntegrationTest
@RecordApplicationEvents
class SessionIntegrationTest {

    private static final String EMAIL = "artist@example.com";

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
    void loginReturnsAccessTokenAndRefreshCookie() throws Exception {
        api.activeAccount(EMAIL, events);

        var result = api.post("/api/v1/auth/login", Map.of("email", "Artist@Example.com",
                        "password", IdentityTestSupport.PASSWORD))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.expiresIn").value(900))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, Matchers.allOf(
                        Matchers.startsWith("sos_refresh="),
                        Matchers.containsString("Path=/api/v1/auth"),
                        Matchers.containsString("HttpOnly"),
                        Matchers.containsString("Secure"),
                        Matchers.containsString("SameSite=Lax"),
                        Matchers.containsString("Max-Age=2592000"))))
                .andReturn();

        mockMvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + api.accessToken(result)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(EMAIL))
                .andExpect(jsonPath("$.role").value("ARTIST"))
                .andExpect(jsonPath("$.locale").value("pl"));
    }

    @Test
    void sameErrorForUnknownEmailAndWrongPassword() throws Exception {
        api.activeAccount(EMAIL, events);

        api.post("/api/v1/auth/login", Map.of("email", EMAIL, "password", "wrong password!"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("IDENTITY_INVALID_CREDENTIALS"))
                .andExpect(jsonPath("$.detail").value("Nieprawidłowy e-mail lub hasło."));
        api.post("/api/v1/auth/login", Map.of("email", "nobody@example.com", "password", "wrong password!"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("IDENTITY_INVALID_CREDENTIALS"));
    }

    @Test
    void unverifiedAndBlockedAccountsCannotLogIn() throws Exception {
        api.register(EMAIL, "ARTIST");
        api.post("/api/v1/auth/login", Map.of("email", EMAIL, "password", IdentityTestSupport.PASSWORD))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("IDENTITY_EMAIL_NOT_VERIFIED"));

        jdbc.update("UPDATE identity_user SET status = 'BLOCKED'");
        api.post("/api/v1/auth/login", Map.of("email", EMAIL, "password", IdentityTestSupport.PASSWORD))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("IDENTITY_ACCOUNT_BLOCKED"));
    }

    @Test
    void refreshRotatesTokenAndDetectsReuse() throws Exception {
        api.activeAccount(EMAIL, events);
        var first = IdentityTestSupport.refreshCookie(api.login(EMAIL));

        var refreshed = api.refresh(first)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andReturn();
        var second = IdentityTestSupport.refreshCookie(refreshed);
        assertThat(second).isNotEqualTo(first);

        // The old token again: treated as stolen, the whole family is revoked and the cookie cleared.
        api.refresh(first)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("IDENTITY_REFRESH_INVALID"))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, Matchers.containsString("Max-Age=0")));
        api.refresh(second).andExpect(status().isUnauthorized());
    }

    @Test
    void refreshWithoutCookieOrWithExpiredTokenFails() throws Exception {
        api.refresh(null)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("IDENTITY_REFRESH_INVALID"));

        api.activeAccount(EMAIL, events);
        var token = IdentityTestSupport.refreshCookie(api.login(EMAIL));
        jdbc.update("UPDATE identity_refresh_token SET expires_at = now() - interval '1 second'");
        api.refresh(token).andExpect(status().isUnauthorized());
    }

    @Test
    void refreshFailsOnceAccountIsBlocked() throws Exception {
        api.activeAccount(EMAIL, events);
        var token = IdentityTestSupport.refreshCookie(api.login(EMAIL));
        jdbc.update("UPDATE identity_user SET status = 'BLOCKED'");

        api.refresh(token).andExpect(status().isUnauthorized());
    }

    @Test
    void logoutRevokesSessionAndClearsCookie() throws Exception {
        api.activeAccount(EMAIL, events);
        var token = IdentityTestSupport.refreshCookie(api.login(EMAIL));

        mockMvc.perform(MockMvcRequestBuilders.post("/api/v1/auth/logout")
                        .cookie(new Cookie(IdentityTestSupport.REFRESH_COOKIE, token)))
                .andExpect(status().isNoContent())
                .andExpect(header().string(HttpHeaders.SET_COOKIE, Matchers.containsString("Max-Age=0")));

        api.refresh(token).andExpect(status().isUnauthorized());
        // Logging out without a session is not an error.
        mockMvc.perform(MockMvcRequestBuilders.post("/api/v1/auth/logout")).andExpect(status().isNoContent());
    }

    @Test
    void meRequiresValidBearerToken() throws Exception {
        mockMvc.perform(get("/api/v1/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        mockMvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, "Bearer not-a-jwt"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }
}
