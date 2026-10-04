package pl.spotonslot.shared.error;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import pl.spotonslot.support.IntegrationTest;

@IntegrationTest
@WithMockUser
class ProblemDetailsIntegrationTest {

    private static final String PROBLEM_JSON = "application/problem+json";

    @Autowired
    MockMvc mockMvc;

    private ResultActions problem(ResultActions actions, int status, String code, String instance) throws Exception {
        return actions
                .andExpect(status().is(status))
                .andExpect(content().contentTypeCompatibleWith(PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(status))
                .andExpect(jsonPath("$.code").value(code))
                .andExpect(jsonPath("$.instance").value(instance));
    }

    @Test
    void notFound() throws Exception {
        problem(mockMvc.perform(get("/test/errors/not-found")), 404, "ARTIST_NOT_FOUND", "/test/errors/not-found")
                .andExpect(jsonPath("$.title").value("Nie znaleziono"));
    }

    @Test
    void notFoundInEnglish() throws Exception {
        problem(mockMvc.perform(get("/test/errors/not-found").header("Accept-Language", "en")),
                404, "ARTIST_NOT_FOUND", "/test/errors/not-found")
                .andExpect(jsonPath("$.title").value("Not found"));
    }

    @Test
    void businessRule() throws Exception {
        problem(mockMvc.perform(get("/test/errors/business")), 422, "BOOKING_SLOT_TAKEN", "/test/errors/business");
    }

    @Test
    void optimisticLock() throws Exception {
        problem(mockMvc.perform(get("/test/errors/optimistic")), 409, "CONCURRENT_MODIFICATION",
                "/test/errors/optimistic");
    }

    @Test
    void unexpected() throws Exception {
        var body = problem(mockMvc.perform(get("/test/errors/boom")), 500, "INTERNAL_ERROR", "/test/errors/boom")
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("secret");
    }

    @Test
    void validation() throws Exception {
        problem(mockMvc.perform(post("/test/errors/validated")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nickname\":\"\",\"city\":\"Warszawa\"}")),
                400, "VALIDATION_FAILED", "/test/errors/validated")
                .andExpect(jsonPath("$.errors[*].field").value(org.hamcrest.Matchers.hasItems("nickname", "city")))
                .andExpect(jsonPath("$.errors[?(@.field=='nickname')].code").value("NotBlank"));
    }

    @Test
    void validationMessagesFollowRequestLocale() throws Exception {
        mockMvc.perform(post("/test/errors/validated")
                        .header("Accept-Language", "en")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nickname\":\"\",\"city\":\"Warszawa\"}"))
                .andExpect(jsonPath("$.errors[?(@.field=='nickname')].message").value("must not be blank"));
    }

    @Test
    void malformedJson() throws Exception {
        problem(mockMvc.perform(post("/test/errors/validated")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nickname\":")),
                400, "MALFORMED_REQUEST", "/test/errors/validated");
    }

    @Test
    void unknownPath() throws Exception {
        problem(mockMvc.perform(get("/api/v1/does-not-exist")), 404, "NOT_FOUND", "/api/v1/does-not-exist");
    }

    @Test
    void wrongMethod() throws Exception {
        problem(mockMvc.perform(delete("/test/errors/not-found")), 405, "METHOD_NOT_ALLOWED",
                "/test/errors/not-found");
    }

    @Test
    void unsupportedMediaType() throws Exception {
        problem(mockMvc.perform(post("/test/errors/validated")
                        .contentType(MediaType.TEXT_PLAIN)
                        .content("x")),
                415, "UNSUPPORTED_MEDIA_TYPE", "/test/errors/validated");
    }

    @Test
    void missingRequestParameter() throws Exception {
        problem(mockMvc.perform(get("/test/errors/param")), 400, "VALIDATION_FAILED", "/test/errors/param");
    }

    @Test
    void notAcceptable() throws Exception {
        problem(mockMvc.perform(get("/test/errors/json-only").header("Accept", "application/xml")),
                406, "INTERNAL_ERROR", "/test/errors/json-only");
    }
}
