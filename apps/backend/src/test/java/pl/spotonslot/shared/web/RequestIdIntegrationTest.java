package pl.spotonslot.shared.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import pl.spotonslot.support.IntegrationTest;

@IntegrationTest
class RequestIdIntegrationTest {

    private static final String UUID_REGEX =
            "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$";

    @Autowired
    MockMvc mockMvc;

    private String requestIdFor(String incoming) throws Exception {
        var request = get("/api/v1/system/info");
        if (incoming != null) {
            request.header(RequestIdFilter.HEADER, incoming);
        }
        return mockMvc.perform(request).andExpect(status().isOk()).andReturn().getResponse()
                .getHeader(RequestIdFilter.HEADER);
    }

    @Test
    void generatesRequestIdWhenMissing() throws Exception {
        assertThat(requestIdFor(null)).matches(UUID_REGEX);
    }

    @Test
    void keepsValidIncomingRequestId() throws Exception {
        assertThat(requestIdFor("abc-123")).isEqualTo("abc-123");
    }

    @Test
    void replacesInvalidIncomingRequestId() throws Exception {
        assertThat(requestIdFor("bad id!")).matches(UUID_REGEX);
        assertThat(requestIdFor("a".repeat(65))).matches(UUID_REGEX);
    }

    @Test
    void unauthorizedIsProblemWithRequestId() throws Exception {
        mockMvc.perform(get("/api/v1/bookings").header(RequestIdFilter.HEADER, "req-1"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string(RequestIdFilter.HEADER, "req-1"))
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.requestId").value("req-1"));
    }

    @Test
    @WithMockUser(roles = "ARTIST")
    void forbiddenIsProblem() throws Exception {
        mockMvc.perform(get("/test/errors/admin-only").header(RequestIdFilter.HEADER, "req-3"))
                .andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
                .andExpect(jsonPath("$.code").value("FORBIDDEN"))
                .andExpect(jsonPath("$.requestId").value("req-3"));
    }

    @Test
    @WithMockUser
    void errorBodyCarriesRequestId() throws Exception {
        mockMvc.perform(get("/test/errors/not-found").header(RequestIdFilter.HEADER, "req-2"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.requestId").value("req-2"));
    }
}
