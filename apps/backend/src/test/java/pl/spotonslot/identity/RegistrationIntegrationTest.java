package pl.spotonslot.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.test.web.servlet.MockMvc;
import pl.spotonslot.identity.application.AccountService;
import pl.spotonslot.support.IntegrationTest;

@IntegrationTest
@RecordApplicationEvents
class RegistrationIntegrationTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    ApplicationEvents events;

    @Autowired
    AccountService accountService;

    @Autowired
    TermsProperties terms;

    IdentityTestSupport api;

    @BeforeEach
    void setUp() {
        IdentityTestSupport.clean(jdbc);
        api = new IdentityTestSupport(mockMvc, json);
    }

    @Test
    void registersPendingAccountAndSendsVerification() throws Exception {
        api.register(" Artist@Example.com ", "ARTIST").andExpect(status().isAccepted())
                .andExpect(content().string(""));

        var row = jdbc.queryForMap("SELECT email, role, status, locale, password_hash FROM identity_user");
        assertThat(row).containsEntry("email", "artist@example.com")
                .containsEntry("role", "ARTIST")
                .containsEntry("status", "PENDING_VERIFICATION")
                .containsEntry("locale", "pl");
        assertThat((String) row.get("password_hash")).startsWith("{pbkdf2}").doesNotContain(IdentityTestSupport.PASSWORD);
        assertThat(events.stream(EmailVerificationRequested.class)).singleElement()
                .satisfies(event -> {
                    assertThat(event.email()).isEqualTo("artist@example.com");
                    assertThat(event.locale()).isEqualTo("pl");
                    assertThat(event.token()).hasSizeGreaterThan(40);
                });
        assertThat(events.stream(UserRegistered.class)).singleElement()
                .satisfies(event -> assertThat(event.role()).isEqualTo(Role.ARTIST));
        assertThat(jdbc.queryForObject("SELECT token_hash FROM identity_token", String.class))
                .hasSize(64)
                .isNotEqualTo(IdentityTestSupport.lastVerificationToken(events, "artist@example.com"));
    }

    @Test
    void sameResponseForExistingActiveAccountWhichGetsAHeadsUpEmail() throws Exception {
        api.activeAccount("venue@example.com", events);

        api.register("venue@example.com", "VENUE").andExpect(status().isAccepted())
                .andExpect(content().string(""));

        assertThat(jdbc.queryForObject("SELECT count(*) FROM identity_user", Integer.class)).isEqualTo(1);
        assertThat(events.stream(AccountAlreadyExists.class)).singleElement()
                .satisfies(event -> assertThat(event.email()).isEqualTo("venue@example.com"));
    }

    @Test
    void repeatedRegistrationOfPendingAccountDoesNotResendWithinInterval() throws Exception {
        api.register("artist@example.com", "ARTIST").andExpect(status().isAccepted());
        api.register("artist@example.com", "ARTIST").andExpect(status().isAccepted());

        assertThat(events.stream(EmailVerificationRequested.class)).hasSize(1);
        assertThat(events.stream(AccountAlreadyExists.class)).isEmpty();
    }

    @Test
    void rejectsInvalidRegistrationWithFieldErrors() throws Exception {
        api.post("/api/v1/auth/register", Map.of("email", "nope", "password", "short", "role", "ADMIN",
                        "locale", "de", "privacyNoticeAccepted", false, "acceptTerms", false))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors[*].field").value(org.hamcrest.Matchers.containsInAnyOrder(
                        "email", "password", "role", "locale", "privacyNoticeAccepted", "acceptTerms")));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM identity_user", Integer.class)).isZero();
    }

    @Test
    void storesAcceptedTermsVersion() throws Exception {
        api.register("artist@example.com", "ARTIST").andExpect(status().isAccepted());

        var row = jdbc.queryForMap("SELECT terms_accepted_at, terms_version FROM identity_user");
        assertThat(row.get("terms_accepted_at")).isNotNull();
        assertThat(row).containsEntry("terms_version", terms.version());
        assertThat(terms.version()).isEqualTo("2026-10-07");
    }

    @Test
    void rejectsRegistrationWithoutAcceptedTerms() throws Exception {
        var body = new HashMap<String, Object>(Map.of("email", "artist@example.com",
                "password", IdentityTestSupport.PASSWORD, "role", "ARTIST", "locale", "pl",
                "privacyNoticeAccepted", true));
        api.post("/api/v1/auth/register", body)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors[*].field").value(org.hamcrest.Matchers.contains("acceptTerms")));

        body.put("acceptTerms", false);
        api.post("/api/v1/auth/register", body)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[*].field").value(org.hamcrest.Matchers.contains("acceptTerms")));

        // An existing address is rejected the same way, before anything about the account is looked at.
        api.activeAccount("venue@example.com", events);
        body.put("email", "venue@example.com");
        api.post("/api/v1/auth/register", body).andExpect(status().isBadRequest());
        assertThat(events.stream(AccountAlreadyExists.class)).isEmpty();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM identity_user", Integer.class)).isEqualTo(1);
    }

    @Test
    void rejectsPasswordEqualToEmail() throws Exception {
        api.post("/api/v1/auth/register", Map.of("email", "artist.long@example.com",
                        "password", "Artist.Long@example.com", "role", "ARTIST", "locale", "en",
                        "privacyNoticeAccepted", true, "acceptTerms", true))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("IDENTITY_PASSWORD_EQUALS_EMAIL"));
    }

    @Test
    void verifiesEmailAndActivatesAccount() throws Exception {
        api.register("artist@example.com", "ARTIST").andExpect(status().isAccepted());
        var token = IdentityTestSupport.lastVerificationToken(events, "artist@example.com");

        api.post("/api/v1/auth/verify-email", Map.of("token", token)).andExpect(status().isNoContent());
        // Opening the link again is fine.
        api.post("/api/v1/auth/verify-email", Map.of("token", token)).andExpect(status().isNoContent());

        assertThat(jdbc.queryForObject("SELECT status FROM identity_user", String.class)).isEqualTo("ACTIVE");
        assertThat(jdbc.queryForObject("SELECT email_verified_at FROM identity_user", Instant.class)).isNotNull();
    }

    @Test
    void rejectsUnknownAndExpiredVerificationTokens() throws Exception {
        api.post("/api/v1/auth/verify-email", Map.of("token", "unknown-token"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("IDENTITY_TOKEN_INVALID"))
                .andExpect(jsonPath("$.title").value("Nieprawidłowy link"));

        api.register("artist@example.com", "ARTIST").andExpect(status().isAccepted());
        jdbc.update("UPDATE identity_token SET expires_at = now() - interval '1 minute'");
        api.post("/api/v1/auth/verify-email",
                        Map.of("token", IdentityTestSupport.lastVerificationToken(events, "artist@example.com")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("IDENTITY_TOKEN_INVALID"));
        assertThat(jdbc.queryForObject("SELECT status FROM identity_user", String.class))
                .isEqualTo("PENDING_VERIFICATION");
    }

    @Test
    void resendsVerificationOnlyForPendingAccountsAfterInterval() throws Exception {
        api.register("artist@example.com", "ARTIST").andExpect(status().isAccepted());
        api.post("/api/v1/auth/verify-email/resend", Map.of("email", "artist@example.com"))
                .andExpect(status().isAccepted());
        assertThat(events.stream(EmailVerificationRequested.class)).hasSize(1);

        jdbc.update("UPDATE identity_token SET created_at = now() - interval '2 minutes'");
        api.post("/api/v1/auth/verify-email/resend", Map.of("email", "ARTIST@example.com"))
                .andExpect(status().isAccepted());
        assertThat(events.stream(EmailVerificationRequested.class)).hasSize(2);

        api.post("/api/v1/auth/verify-email/resend", Map.of("email", "nobody@example.com"))
                .andExpect(status().isAccepted());
        assertThat(events.stream(EmailVerificationRequested.class)).hasSize(2);
    }

    @Test
    void deletesStaleUnverifiedAccounts() throws Exception {
        api.register("old@example.com", "ARTIST").andExpect(status().isAccepted());
        api.activeAccount("active@example.com", events);
        jdbc.update("UPDATE identity_user SET created_at = now() - interval '8 days'");

        assertThat(accountService.deleteStalePending(Instant.now())).isEqualTo(1);
        assertThat(jdbc.queryForList("SELECT email FROM identity_user", String.class))
                .containsExactly("active@example.com");
    }
}
