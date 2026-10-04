package pl.spotonslot;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class SpotOnSlotApplicationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void appliesMigrationsWithPostgis() {
        String version = jdbcTemplate.queryForObject("SELECT postgis_version()", String.class);
        assertThat(version).isNotBlank();
    }

    @Test
    void exposesPublicSystemInfo() throws Exception {
        mockMvc.perform(get("/api/v1/system/info"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("spot-on-slot"));
    }

    @Test
    void securesOtherEndpoints() throws Exception {
        mockMvc.perform(get("/api/v1/bookings"))
                .andExpect(status().isUnauthorized());
    }

    /**
     * Also exports the spec to build/openapi/openapi.json, which packages/api-client generates its types from.
     */
    @Test
    void exposesOpenApiSpec() throws Exception {
        String spec = mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.openapi").exists())
                .andReturn().getResponse().getContentAsString();

        Path output = Path.of("build", "openapi", "openapi.json");
        Files.createDirectories(output.getParent());
        Files.writeString(output, spec);
    }
}
