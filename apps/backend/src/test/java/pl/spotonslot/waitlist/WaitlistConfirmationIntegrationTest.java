package pl.spotonslot.waitlist;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import pl.spotonslot.support.IntegrationTest;
import pl.spotonslot.waitlist.application.WaitlistService;
import pl.spotonslot.waitlist.domain.ConfirmationToken;
import pl.spotonslot.waitlist.domain.WaitlistRole;
import pl.spotonslot.waitlist.domain.WaitlistSignup;
import pl.spotonslot.waitlist.domain.WaitlistStatus;
import pl.spotonslot.waitlist.infrastructure.WaitlistSignupRepository;

@IntegrationTest
class WaitlistConfirmationIntegrationTest {

    private static final String CONFIRMATIONS = "/api/v1/waitlist/confirmations";

    @Autowired
    MockMvc mockMvc;

    @Autowired
    WaitlistSignupRepository repository;

    @Autowired
    WaitlistService service;

    @Autowired
    JdbcTemplate jdbc;

    @BeforeEach
    void setUp() {
        repository.deleteAll();
    }

    @Test
    void confirmsPendingSignup() throws Exception {
        var token = pendingSignup("artist@example.com");

        confirm(token).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONFIRMED"));

        var signup = signup("artist@example.com");
        assertThat(signup.getStatus()).isEqualTo(WaitlistStatus.CONFIRMED);
        assertThat(signup.getConfirmedAt()).isNotNull();
    }

    @Test
    void confirmingTwiceWithSameTokenSucceeds() throws Exception {
        var token = pendingSignup("artist@example.com");
        confirm(token).andExpect(status().isOk());
        var confirmedAt = signup("artist@example.com").getConfirmedAt();

        confirm(token).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONFIRMED"));

        assertThat(signup("artist@example.com").getConfirmedAt()).isEqualTo(confirmedAt);
    }

    @Test
    void rejectsUnknownToken() throws Exception {
        confirm(ConfirmationToken.generate())
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.code").value("WAITLIST_TOKEN_INVALID"))
                .andExpect(jsonPath("$.title").value("Nieprawidłowy link"))
                .andExpect(jsonPath("$.detail").value("Link potwierdzający jest nieprawidłowy."));
    }

    @Test
    void rejectsUnknownTokenInEnglish() throws Exception {
        mockMvc.perform(post(CONFIRMATIONS).header("Accept-Language", "en").contentType(MediaType.APPLICATION_JSON)
                        .content(body(ConfirmationToken.generate())))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("WAITLIST_TOKEN_INVALID"))
                .andExpect(jsonPath("$.title").value("Invalid link"))
                .andExpect(jsonPath("$.detail").value("The confirmation link is invalid."));
    }

    @Test
    void rejectsExpiredToken() throws Exception {
        var token = pendingSignup("artist@example.com");
        jdbc.update("update waitlist_signup set token_expires_at = now() - interval '1 minute'");

        confirm(token)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.code").value("WAITLIST_TOKEN_EXPIRED"))
                .andExpect(jsonPath("$.title").value("Link wygasł"))
                .andExpect(jsonPath("$.detail").value("Link potwierdzający wygasł. Zapisz się ponownie."));

        assertThat(signup("artist@example.com").getStatus()).isEqualTo(WaitlistStatus.PENDING);
    }

    @Test
    void rejectsBlankToken() throws Exception {
        confirm("  ")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors[0].field").value("token"));
    }

    @Test
    void deletesOnlyStalePendingSignups() {
        pendingSignup("stale@example.com");
        pendingSignup("recent@example.com");
        pendingSignup("confirmed@example.com");
        setCreatedAtDaysAgo("stale@example.com", 8);
        setCreatedAtDaysAgo("recent@example.com", 1);
        setCreatedAtDaysAgo("confirmed@example.com", 30);
        jdbc.update("update waitlist_signup set status = 'CONFIRMED', confirmed_at = now() where email = ?",
                "confirmed@example.com");

        var deleted = service.deleteStalePending(Instant.now());

        assertThat(deleted).isEqualTo(1);
        assertThat(repository.findAll()).extracting(WaitlistSignup::getEmail)
                .containsExactlyInAnyOrder("recent@example.com", "confirmed@example.com");
    }

    private String pendingSignup(String email) {
        var token = ConfirmationToken.generate();
        var now = Instant.now();
        repository.saveAndFlush(WaitlistSignup.pending(email, WaitlistRole.ARTIST, "Kraków", "pl",
                ConfirmationToken.hash(token), now.plus(Duration.ofHours(48)), now));
        return token;
    }

    private void setCreatedAtDaysAgo(String email, int days) {
        jdbc.update("update waitlist_signup set created_at = now() - make_interval(days => ?) where email = ?",
                days, email);
    }

    private ResultActions confirm(String token) throws Exception {
        return mockMvc.perform(post(CONFIRMATIONS).contentType(MediaType.APPLICATION_JSON).content(body(token)));
    }

    private static String body(String token) {
        return """
                {"token":"%s"}""".formatted(token);
    }

    private WaitlistSignup signup(String email) {
        return repository.findByEmail(email).orElseThrow();
    }
}
