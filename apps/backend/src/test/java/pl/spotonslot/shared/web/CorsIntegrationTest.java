package pl.spotonslot.shared.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;
import pl.spotonslot.support.IntegrationTest;

@IntegrationTest
class CorsIntegrationTest {

    private static final String ALLOWED_ORIGIN = "http://localhost:3000";

    @Autowired
    MockMvc mockMvc;

    @Test
    void allowsConfiguredOriginPreflight() throws Exception {
        mockMvc.perform(options("/api/v1/system/info")
                        .header(HttpHeaders.ORIGIN, ALLOWED_ORIGIN)
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, ALLOWED_ORIGIN))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_MAX_AGE, "3600"));
    }

    @Test
    void exposesRequestIdHeader() throws Exception {
        var response = mockMvc.perform(get("/api/v1/system/info").header(HttpHeaders.ORIGIN, ALLOWED_ORIGIN))
                .andExpect(status().isOk())
                .andReturn().getResponse();

        assertThat(response.getHeader(HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS)).contains("X-Request-Id");
    }

    @Test
    void rejectsUnknownOrigin() throws Exception {
        mockMvc.perform(options("/api/v1/system/info")
                        .header(HttpHeaders.ORIGIN, "https://evil.example")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
    }
}
