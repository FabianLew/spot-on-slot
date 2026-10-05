package pl.spotonslot;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import pl.spotonslot.support.IntegrationTest;

@IntegrationTest
@ActiveProfiles({"test", "prod"})
@TestPropertySource(properties = {
    "CORS_ALLOWED_ORIGINS=https://app.spotonslot.pl",
    "MAIL_HOST=smtp.example.com",
    "MAIL_FROM=no-reply@spotonslot.pl",
    "LANDING_BASE_URL=https://spotonslot.pl"
})
class ProdProfileIntegrationTest {

    @Autowired
    MockMvc mockMvc;

    @Test
    void apiDocsAreDisabled() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }
}
