package pl.spotonslot.waitlist;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doReturn;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.event.EventListener;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import pl.spotonslot.support.IntegrationTest;
import pl.spotonslot.waitlist.domain.ConfirmationToken;
import pl.spotonslot.waitlist.domain.WaitlistRole;
import pl.spotonslot.waitlist.domain.WaitlistSignup;
import pl.spotonslot.waitlist.domain.WaitlistStatus;
import pl.spotonslot.waitlist.infrastructure.WaitlistSignupRepository;

@IntegrationTest
class WaitlistSignupIntegrationTest {

    private static final String SIGNUPS = "/api/v1/waitlist/signups";
    private static final String EMAIL = "artist@example.com";

    @Autowired
    MockMvc mockMvc;

    @MockitoSpyBean
    WaitlistSignupRepository repository;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    RecordedEvents events;

    @BeforeEach
    void setUp() {
        repository.deleteAll();
        events.clear();
    }

    @Test
    void createsPendingSignupAndRequestsConfirmation() throws Exception {
        signUp(body(EMAIL, "ARTIST", "Kraków", "en", true, null)).andExpect(status().isAccepted())
                .andExpect(content().string(""));

        var signup = signup(EMAIL);
        assertThat(signup.getStatus()).isEqualTo(WaitlistStatus.PENDING);
        assertThat(signup.getRole()).isEqualTo(WaitlistRole.ARTIST);
        assertThat(signup.getCity()).isEqualTo("Kraków");
        assertThat(signup.getLocale()).isEqualTo("en");
        assertThat(signup.getConsentAt()).isNotNull();
        assertThat(signup.getTokenSentAt()).isNotNull();
        assertThat(signup.getTokenExpiresAt()).isEqualTo(signup.getTokenSentAt().plus(Duration.ofHours(48)));
        assertThat(signup.getConfirmedAt()).isNull();

        assertThat(events.list()).singleElement().satisfies(event -> {
            assertThat(event.email()).isEqualTo(EMAIL);
            assertThat(event.locale()).isEqualTo("en");
            assertThat(ConfirmationToken.hash(event.token())).isEqualTo(signup.getTokenHash());
        });
    }

    @Test
    void storesEmailLowercasedAndTrimsCity() throws Exception {
        signUp(body("Foo@Bar.PL", "VENUE", "  Gdańsk ", "pl", true, null)).andExpect(status().isAccepted());

        var signup = signup("foo@bar.pl");
        assertThat(signup.getCity()).isEqualTo("Gdańsk");
        assertThat(events.list()).singleElement().extracting(WaitlistConfirmationRequested::email)
                .isEqualTo("foo@bar.pl");
    }

    @Test
    void repeatedSignupWithinResendIntervalUpdatesDetailsWithoutNewEmail() throws Exception {
        signUp(body(EMAIL, "ARTIST", "Kraków", "pl", true, null)).andExpect(status().isAccepted());
        var tokenHash = signup(EMAIL).getTokenHash();
        moveTokenSentAtBack(Duration.ofMinutes(1));
        events.clear();

        signUp(body(EMAIL.toUpperCase(), "BOOKER", "Poznań", "en", true, null)).andExpect(status().isAccepted());

        assertThat(repository.count()).isEqualTo(1);
        var signup = signup(EMAIL);
        assertThat(signup.getRole()).isEqualTo(WaitlistRole.BOOKER);
        assertThat(signup.getCity()).isEqualTo("Poznań");
        assertThat(signup.getLocale()).isEqualTo("en");
        assertThat(signup.getTokenHash()).isEqualTo(tokenHash);
        assertThat(events.list()).isEmpty();
    }

    @Test
    void repeatedSignupAfterResendIntervalIssuesNewToken() throws Exception {
        signUp(body(EMAIL, "ARTIST", "Kraków", "pl", true, null)).andExpect(status().isAccepted());
        var tokenHash = signup(EMAIL).getTokenHash();
        moveTokenSentAtBack(Duration.ofMinutes(11));
        events.clear();

        signUp(body(EMAIL, "ARTIST", "Kraków", "en", true, null)).andExpect(status().isAccepted());

        assertThat(repository.count()).isEqualTo(1);
        var signup = signup(EMAIL);
        assertThat(signup.getTokenHash()).isNotEqualTo(tokenHash);
        assertThat(events.list()).singleElement().satisfies(event -> {
            assertThat(event.locale()).isEqualTo("en");
            assertThat(ConfirmationToken.hash(event.token())).isEqualTo(signup.getTokenHash());
        });
    }

    @Test
    void confirmedSignupIsLeftUntouched() throws Exception {
        signUp(body(EMAIL, "ARTIST", "Kraków", "pl", true, null)).andExpect(status().isAccepted());
        jdbc.update("update waitlist_signup set status = 'CONFIRMED', confirmed_at = now(), "
                + "token_sent_at = token_sent_at - interval '1 day'");
        var before = signup(EMAIL);
        events.clear();

        signUp(body(EMAIL, "VENUE", "Łódź", "en", true, null)).andExpect(status().isAccepted());

        var after = signup(EMAIL);
        assertThat(after.getStatus()).isEqualTo(WaitlistStatus.CONFIRMED);
        assertThat(after.getRole()).isEqualTo(WaitlistRole.ARTIST);
        assertThat(after.getCity()).isEqualTo("Kraków");
        assertThat(after.getLocale()).isEqualTo("pl");
        assertThat(after.getTokenHash()).isEqualTo(before.getTokenHash());
        assertThat(after.getVersion()).isEqualTo(before.getVersion());
        assertThat(events.list()).isEmpty();
    }

    @Test
    void filledHoneypotIsAcceptedButIgnored() throws Exception {
        signUp(body(EMAIL, "ARTIST", "Kraków", "pl", true, "x")).andExpect(status().isAccepted())
                .andExpect(content().string(""));

        assertThat(repository.count()).isZero();
        assertThat(events.list()).isEmpty();
    }

    @Test
    void concurrentSignupOfSameEmailIsAccepted() throws Exception {
        signUp(body(EMAIL, "ARTIST", "Kraków", "pl", true, null)).andExpect(status().isAccepted());
        events.clear();
        // Simulates a parallel request that inserted the row between this request's lookup and insert.
        doReturn(Optional.empty()).when(repository).findByEmail(anyString());

        signUp(body(EMAIL, "BOOKER", "Poznań", "pl", true, null)).andExpect(status().isAccepted())
                .andExpect(content().string(""));

        assertThat(repository.count()).isEqualTo(1);
        assertThat(events.list()).isEmpty();
    }

    @Test
    void rejectsInvalidBody() throws Exception {
        signUp(body("not-an-email", "ADMIN", "a", "de", false, null))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors[*].field")
                        .value(containsInAnyOrder("email", "role", "city", "locale", "consent")));

        assertThat(repository.count()).isZero();
        assertThat(events.list()).isEmpty();
    }

    @Test
    void rejectsLowercaseRoleAsFieldError() throws Exception {
        signUp(body(EMAIL, "artist", "Kraków", "pl", true, null))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors[*].field").value(containsInAnyOrder("role")));
    }

    @Test
    void concurrentResendForSamePendingSignupIsAccepted() throws Exception {
        signUp(body(EMAIL, "ARTIST", "Kraków", "pl", true, null)).andExpect(status().isAccepted());
        moveTokenSentAtBack(Duration.ofMinutes(11));
        var tokenHash = signup(EMAIL).getTokenHash();
        // Simulates a parallel request that updated the row (and resent the e-mail) after this request loaded it.
        doAnswer(invocation -> {
            // Interface methods of the spied repository proxy cannot callRealMethod(); load through an unstubbed one.
            var loaded = repository.findAll().stream().filter(s -> s.getEmail().equals(invocation.getArgument(0)))
                    .findFirst();
            jdbc.update("update waitlist_signup set version = version + 1");
            return loaded;
        }).when(repository).findByEmail(anyString());

        signUp(body(EMAIL, "BOOKER", "Poznań", "en", true, null)).andExpect(status().isAccepted())
                .andExpect(content().string(""));

        var signup = signup(EMAIL);
        assertThat(signup.getTokenHash()).isEqualTo(tokenHash);
        assertThat(signup.getRole()).isEqualTo(WaitlistRole.ARTIST);
    }

    @Test
    void rejectsCityThatIsTooShortAfterTrimming() throws Exception {
        signUp(body(EMAIL, "ARTIST", "  a  ", "pl", true, null))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[*].field").value(containsInAnyOrder("city")));
    }

    @Test
    void rejectsMissingFields() throws Exception {
        signUp("{}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors[*].field").value(org.hamcrest.Matchers.hasItems(
                        "email", "role", "city", "locale", "consent")));
    }

    private ResultActions signUp(String json) throws Exception {
        return mockMvc.perform(post(SIGNUPS).contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private static String body(String email, String role, String city, String locale, boolean consent,
            String website) {
        return """
                {"email":"%s","role":"%s","city":"%s","locale":"%s","consent":%s,"website":%s}"""
                .formatted(email, role, city, locale, consent, website == null ? "null" : "\"" + website + "\"");
    }

    private WaitlistSignup signup(String email) {
        return repository.findAll().stream().filter(s -> s.getEmail().equals(email)).findFirst().orElseThrow();
    }

    private void moveTokenSentAtBack(Duration duration) {
        jdbc.update("update waitlist_signup set token_sent_at = token_sent_at - make_interval(secs => ?)",
                duration.toSeconds());
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class EventRecorderConfig {

        @Bean
        RecordedEvents recordedEvents() {
            return new RecordedEvents();
        }
    }

    static class RecordedEvents {

        private final List<WaitlistConfirmationRequested> events = new CopyOnWriteArrayList<>();

        @EventListener
        void on(WaitlistConfirmationRequested event) {
            events.add(event);
        }

        List<WaitlistConfirmationRequested> list() {
            return List.copyOf(events);
        }

        void clear() {
            events.clear();
        }
    }
}
