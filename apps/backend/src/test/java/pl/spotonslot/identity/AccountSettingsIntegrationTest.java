package pl.spotonslot.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import jakarta.persistence.Entity;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.UUID;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.aop.support.AopUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.modulith.core.ApplicationModules;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import pl.spotonslot.SpotOnSlotApplication;
import pl.spotonslot.identity.application.AccountPurgeService;
import pl.spotonslot.support.IntegrationTest;

@IntegrationTest
@RecordApplicationEvents
class AccountSettingsIntegrationTest {

    private static final String EMAIL = "artist@example.com";
    private static final String NEW_PASSWORD = "a new horse battery";

    @MockitoBean
    JavaMailSenderImpl mailSender;

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper json;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    ApplicationEvents events;

    @Autowired
    AccountPurgeService purge;

    @Autowired
    List<PersonalDataSection> sections;

    IdentityTestSupport api;
    Instant started;

    @BeforeEach
    void setUp() {
        started = Instant.now();
        when(mailSender.createMimeMessage()).thenAnswer(invocation ->
                new MimeMessage(Session.getInstance(new Properties())));
        IdentityTestSupport.clean(jdbc);
        api = new IdentityTestSupport(mockMvc, json);
    }

    /** Lets this test's listeners (e-mails, module clean-ups) finish before the next test deletes rows. */
    @AfterEach
    void awaitListeners() {
        await().atMost(Duration.ofSeconds(10)).until(() -> jdbc.queryForObject(
                "SELECT count(*) FROM event_publication WHERE completion_date IS NULL AND publication_date >= ?",
                Integer.class, Timestamp.from(started)) == 0);
    }

    @Test
    void meReportsTermsAndTheNewVersionCanBeAccepted() throws Exception {
        var token = signedIn(EMAIL);
        as(token, get("/api/v1/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.termsAccepted").value(true))
                .andExpect(jsonPath("$.termsVersion").value("2026-10-07"))
                .andExpect(jsonPath("$.deletionScheduledAt").doesNotExist());

        // An account from before the current terms (or before terms were stored at all).
        jdbc.update("UPDATE identity_user SET terms_version = NULL, terms_accepted_at = NULL");
        as(token, get("/api/v1/me")).andExpect(jsonPath("$.termsAccepted").value(false));

        as(token, post("/api/v1/me/terms")).andExpect(status().isNoContent());
        as(token, get("/api/v1/me")).andExpect(jsonPath("$.termsAccepted").value(true));
        assertThat(jdbc.queryForObject("SELECT terms_version FROM identity_user", String.class))
                .isEqualTo("2026-10-07");
        assertThat(jdbc.queryForObject("SELECT terms_accepted_at FROM identity_user", Timestamp.class)).isNotNull();
    }

    @Test
    void changingThePasswordKeepsThisSessionAndEndsTheOthers() throws Exception {
        api.activeAccount(EMAIL, events);
        var here = api.login(EMAIL);
        var elsewhere = api.login(EMAIL);
        var token = api.accessToken(here);

        changePassword(token, "wrong password!", NEW_PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("IDENTITY_WRONG_PASSWORD"))
                .andExpect(jsonPath("$.errors[0].field").value("currentPassword"))
                .andExpect(jsonPath("$.errors[0].message").value("Hasło jest nieprawidłowe."));
        changePassword(token, IdentityTestSupport.PASSWORD, "short")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

        changePassword(token, IdentityTestSupport.PASSWORD, NEW_PASSWORD).andExpect(status().isNoContent());

        api.refresh(IdentityTestSupport.refreshCookie(here)).andExpect(status().isOk());
        api.refresh(IdentityTestSupport.refreshCookie(elsewhere)).andExpect(status().isUnauthorized());
        api.post("/api/v1/auth/login", Map.of("email", EMAIL, "password", IdentityTestSupport.PASSWORD))
                .andExpect(status().isUnauthorized());
        api.post("/api/v1/auth/login", Map.of("email", EMAIL, "password", NEW_PASSWORD))
                .andExpect(status().isOk());
        assertThat(events.stream(PasswordChanged.class)).singleElement()
                .satisfies(event -> assertThat(event.email()).isEqualTo(EMAIL));
    }

    @Test
    void fiveWrongPasswordsLockAccountChangesForAWhile() throws Exception {
        var token = signedIn(EMAIL);
        for (var attempt = 0; attempt < 5; attempt++) {
            changePassword(token, "wrong password " + attempt, NEW_PASSWORD).andExpect(status().isBadRequest());
        }
        // Even the right password waits now, in every action that asks for it.
        changePassword(token, IdentityTestSupport.PASSWORD, NEW_PASSWORD)
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("ACCOUNT_TOO_MANY_ATTEMPTS"))
                .andExpect(jsonPath("$.detail").value("Za dużo nieudanych prób hasła. Spróbuj za kilka minut."));
        requestDeletion(token, IdentityTestSupport.PASSWORD, true).andExpect(status().isTooManyRequests());
        assertThat(events.stream(PasswordChanged.class)).isEmpty();
    }

    @Test
    void emailChangeIsConfirmedFromTheNewAddress() throws Exception {
        var token = signedIn(EMAIL);
        changeEmail(token, "Fresh@Example.com", "wrong password!")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("currentPassword"));
        changeEmail(token, EMAIL, IdentityTestSupport.PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("IDENTITY_EMAIL_UNCHANGED"))
                .andExpect(jsonPath("$.errors[0].field").value("newEmail"));

        changeEmail(token, "Fresh@Example.com", IdentityTestSupport.PASSWORD).andExpect(status().isAccepted());
        var requested = events.stream(EmailChangeRequested.class).toList();
        assertThat(requested).singleElement().satisfies(event -> {
            assertThat(event.currentEmail()).isEqualTo(EMAIL);
            assertThat(event.newEmail()).isEqualTo("fresh@example.com");
            assertThat(event.taken()).isFalse();
            assertThat(event.token()).isNotBlank();
        });
        // Asked again right away: the same answer, no second e-mail.
        changeEmail(token, "other@example.com", IdentityTestSupport.PASSWORD).andExpect(status().isAccepted());
        assertThat(events.stream(EmailChangeRequested.class)).hasSize(1);
        // Nothing changes until the link is opened.
        as(token, get("/api/v1/me")).andExpect(jsonPath("$.email").value(EMAIL));

        confirmEmail(requested.getFirst().token()).andExpect(status().isNoContent());
        as(token, get("/api/v1/me")).andExpect(jsonPath("$.email").value("fresh@example.com"));
        api.post("/api/v1/auth/login", Map.of("email", "fresh@example.com", "password",
                IdentityTestSupport.PASSWORD)).andExpect(status().isOk());
        api.post("/api/v1/auth/login", Map.of("email", EMAIL, "password", IdentityTestSupport.PASSWORD))
                .andExpect(status().isUnauthorized());
        confirmEmail(requested.getFirst().token())
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("IDENTITY_TOKEN_INVALID"));
    }

    @Test
    void emailChangeToAnAddressWithAnAccountLooksTheSameButSendsNoLink() throws Exception {
        api.activeAccount("taken@example.com", events);
        var token = signedIn(EMAIL);

        changeEmail(token, "taken@example.com", IdentityTestSupport.PASSWORD).andExpect(status().isAccepted());

        assertThat(events.stream(EmailChangeRequested.class)).singleElement().satisfies(event -> {
            assertThat(event.taken()).isTrue();
            assertThat(event.token()).isNull();
        });
        assertThat(jdbc.queryForObject("SELECT count(*) FROM identity_token WHERE type = 'EMAIL_CHANGE'"
                + " AND used_at IS NULL", Integer.class)).isZero();
    }

    @Test
    void anAddressTakenBeforeTheConfirmationIsAConflict() throws Exception {
        var token = signedIn(EMAIL);
        changeEmail(token, "fresh@example.com", IdentityTestSupport.PASSWORD).andExpect(status().isAccepted());
        var link = events.stream(EmailChangeRequested.class).findFirst().orElseThrow().token();
        api.activeAccount("fresh@example.com", events);

        confirmEmail(link)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IDENTITY_EMAIL_TAKEN"));
        as(token, get("/api/v1/me")).andExpect(jsonPath("$.email").value(EMAIL));
    }

    @Test
    void aNewPasswordCancelsAPendingEmailChange() throws Exception {
        var token = signedIn(EMAIL);
        changeEmail(token, "fresh@example.com", IdentityTestSupport.PASSWORD).andExpect(status().isAccepted());
        var link = events.stream(EmailChangeRequested.class).findFirst().orElseThrow().token();

        changePassword(token, IdentityTestSupport.PASSWORD, NEW_PASSWORD).andExpect(status().isNoContent());

        confirmEmail(link).andExpect(status().isBadRequest());
    }

    @Test
    void exportIsAJsonFileWithASectionPerModuleOnceAMinute() throws Exception {
        var token = signedIn(EMAIL);

        var result = as(token, get("/api/v1/me/export"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, Matchers.matchesPattern(
                        "attachment; filename=\"spot-on-slot-dane-\\d{4}-\\d{2}-\\d{2}\\.json\"")))
                .andExpect(jsonPath("$.exportedAt").isNotEmpty())
                .andExpect(jsonPath("$.account.email").value(EMAIL))
                .andExpect(jsonPath("$.account.role").value("ARTIST"))
                .andExpect(jsonPath("$.account.termsVersion").value("2026-10-07"))
                .andExpect(jsonPath("$.account.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.listings").isArray())
                .andExpect(jsonPath("$.bookings").isArray())
                .andExpect(jsonPath("$.conversations").isArray())
                .andExpect(jsonPath("$.media").isArray())
                .andExpect(jsonPath("$.calendar.slots").isArray())
                .andExpect(jsonPath("$.venues.venues").isArray())
                .andExpect(jsonPath("$.notifications.preferences").exists())
                .andReturn();
        var keys = json.readTree(result.getResponse().getContentAsString()).fieldNames();
        assertThat(keys).toIterable().containsExactly("exportedAt", "account", "artistProfile", "bookings",
                "calendar", "conversations", "listings", "location", "media", "notifications", "venues",
                "waitlist");

        as(token, get("/api/v1/me/export"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("ACCOUNT_EXPORT_TOO_SOON"));
    }

    @Test
    void everyModuleWithTablesContributesToTheExport() {
        var modules = ApplicationModules.of(SpotOnSlotApplication.class);
        var withTables = modules.stream()
                .filter(module -> !module.getName().equals("shared"))
                .filter(module -> module.getBasePackage().stream()
                        .anyMatch(type -> type.isAnnotatedWith(Entity.class)))
                .map(module -> module.getName())
                .toList();
        var contributing = sections.stream()
                .map(section -> modules.getModuleByType(AopUtils.getTargetClass(section).getName())
                        .orElseThrow().getName())
                .toList();

        assertThat(withTables).isNotEmpty();
        assertThat(contributing).containsAll(withTables);
        assertThat(sections.stream().map(PersonalDataSection::key)).doesNotHaveDuplicates();
    }

    @Test
    void deletionSignsOutBlocksTheApiAndCanBeTakenBack() throws Exception {
        api.activeAccount(EMAIL, events);
        var session = api.login(EMAIL);
        var token = api.accessToken(session);

        requestDeletion(token, "wrong password!", true)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("IDENTITY_WRONG_PASSWORD"))
                .andExpect(jsonPath("$.errors[0].field").value("password"));
        requestDeletion(token, IdentityTestSupport.PASSWORD, false)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors[0].field").value("confirm"));
        as(token, get("/api/v1/me/deletion"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.blockers").isEmpty())
                .andExpect(jsonPath("$.graceDays").value(14));

        var answer = requestDeletion(token, IdentityTestSupport.PASSWORD, true)
                .andExpect(status().isAccepted())
                .andReturn();
        var scheduled = Instant.parse(json.readTree(answer.getResponse().getContentAsString())
                .get("deletionScheduledAt").asText());
        assertThat(scheduled).isCloseTo(Instant.now().plus(Duration.ofDays(14)), within(Duration.ofMinutes(1)));
        assertThat(events.stream(AccountDeletionRequested.class)).singleElement()
                .satisfies(event -> assertThat(event.deletionAt()).isEqualTo(scheduled));

        // Signed out everywhere, but signing in works, to reach "restore".
        api.refresh(IdentityTestSupport.refreshCookie(session)).andExpect(status().isUnauthorized());
        var again = api.login(EMAIL);
        token = api.accessToken(again);
        as(token, get("/api/v1/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deletionScheduledAt").value(scheduled.toString()));
        for (var blocked : List.of(get("/api/v1/notifications"), get("/api/v1/me/export"), post("/api/v1/me/terms"),
                get("/api/v1/listings/mine"))) {
            as(token, blocked)
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("ACCOUNT_DELETION_PENDING"));
        }
        api.refresh(IdentityTestSupport.refreshCookie(again)).andExpect(status().isOk());

        as(token, post("/api/v1/me/deletion/cancel")).andExpect(status().isNoContent());
        as(token, get("/api/v1/notifications")).andExpect(status().isOk());
        as(token, get("/api/v1/me")).andExpect(jsonPath("$.deletionScheduledAt").doesNotExist());
        assertThat(events.stream(AccountRestored.class)).hasSize(1);
        // Taking back a deletion that is not pending is not an error.
        as(token, post("/api/v1/me/deletion/cancel")).andExpect(status().isNoContent());
        assertThat(events.stream(AccountRestored.class)).hasSize(1);
    }

    @Test
    void accountsArePurgedAfterTheGracePeriod() throws Exception {
        var token = signedIn(EMAIL);
        var id = UUID.fromString(json.readTree(as(token, get("/api/v1/me")).andReturn().getResponse()
                .getContentAsString()).get("id").asText());
        requestDeletion(token, IdentityTestSupport.PASSWORD, true).andExpect(status().isAccepted());

        assertThat(purge.purgeDue(Instant.now().plus(Duration.ofDays(13)))).isZero();
        assertThat(purge.purgeDue(Instant.now().plus(Duration.ofDays(14)).plus(1, ChronoUnit.MINUTES))).isOne();

        assertThat(jdbc.queryForObject("SELECT count(*) FROM identity_user", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM identity_refresh_token", Integer.class)).isZero();
        assertThat(events.stream(AccountDeleted.class)).singleElement().satisfies(event -> {
            assertThat(event.userId()).isEqualTo(id);
            assertThat(event.email()).isEqualTo(EMAIL);
        });
        as(token, get("/api/v1/me")).andExpect(status().isUnauthorized());
    }

    // ---- helpers

    private static org.assertj.core.data.TemporalUnitOffset within(Duration duration) {
        return org.assertj.core.api.Assertions.within(duration.toSeconds(), ChronoUnit.SECONDS);
    }

    private String signedIn(String email) throws Exception {
        api.activeAccount(email, events);
        return api.accessToken(api.login(email));
    }

    private ResultActions as(String token, MockHttpServletRequestBuilder request) throws Exception {
        return mockMvc.perform(request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token));
    }

    private ResultActions changePassword(String token, String current, String next) throws Exception {
        return as(token, put("/api/v1/me/password").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("currentPassword", current, "newPassword", next))));
    }

    private ResultActions changeEmail(String token, String email, String password) throws Exception {
        return as(token, post("/api/v1/me/email-change").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("newEmail", email, "currentPassword", password))));
    }

    private ResultActions confirmEmail(String link) throws Exception {
        return api.post("/api/v1/auth/email-change/confirm", Map.of("token", link));
    }

    private ResultActions requestDeletion(String token, String password, boolean confirm) throws Exception {
        return as(token, post("/api/v1/me/deletion").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("password", password, "confirm", confirm))));
    }

    @SuppressWarnings("unused")
    private static String body(MvcResult result) throws Exception {
        return result.getResponse().getContentAsString();
    }
}
